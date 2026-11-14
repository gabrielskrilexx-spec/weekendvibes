import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  isAdminUser: vi.fn(),
  savePushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
  sendPushNotification: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./_core/admin-auth", () => ({ isAdminUser: mocks.isAdminUser }));
vi.mock("./push-notifications", () => ({
  isAllowedPushEndpoint: (endpoint: string) => /^https:\/\/(?:fcm\.googleapis\.com|web\.push\.apple\.com|(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com)\//i.test(endpoint),
  PushServiceConfigurationError: class PushServiceConfigurationError extends Error {},
  savePushSubscription: mocks.savePushSubscription,
  removePushSubscription: mocks.removePushSubscription,
  sendPushNotification: mocks.sendPushNotification,
}));

import { registerPushRestRoutes } from "./push-rest";

let server: Server;
let baseUrl = "";

async function request(path: string, method: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("Push REST endpoints", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerPushRestRoutes(app);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not start");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateRequest.mockResolvedValue({ id: 1, role: "admin" });
    mocks.isAdminUser.mockImplementation((user: { role?: string } | null) => user?.role === "admin");
    mocks.savePushSubscription.mockResolvedValue(undefined);
    mocks.removePushSubscription.mockResolvedValue(1);
    mocks.sendPushNotification.mockResolvedValue({ sent: 3, failed: 0, expired: 1 });
  });

  it("valida e salva subscription pública sem revelar dados no response", async () => {
    const response = await request("/api/push/subscriptions", "POST", {
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
      keys: { p256dh: "p256dh-public-key-123456", auth: "auth-secret-123" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.savePushSubscription).toHaveBeenCalledWith({
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
      keys: { p256dh: "p256dh-public-key-123456", auth: "auth-secret-123" },
    });
  });

  it("rejeita endpoint não confiável e malformed subscription", async () => {
    const response = await request("/api/push/subscriptions", "POST", {
      endpoint: "https://127.0.0.1/internal",
      keys: { p256dh: "p256dh-public-key-123456", auth: "auth-secret-123" },
    });
    expect(response.status).toBe(400);
    expect(mocks.savePushSubscription).not.toHaveBeenCalled();
  });

  it("remove subscription sem ecoar o endpoint na resposta", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
    const response = await request("/api/push/subscriptions", "DELETE", { endpoint });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.removePushSubscription).toHaveBeenCalledWith(endpoint);
  });

  it("restringe o envio a sessão administrativa", async () => {
    mocks.authenticateRequest.mockRejectedValueOnce(new Error("missing session"));
    expect((await request("/api/v2/admin/push/send", "POST", { title: "Teste", body: "Corpo", url: "/agenda" })).status).toBe(401);
    mocks.authenticateRequest.mockResolvedValueOnce({ id: 2, role: "user" });
    expect((await request("/api/v2/admin/push/send", "POST", { title: "Teste", body: "Corpo", url: "/agenda" })).status).toBe(403);
    expect(mocks.sendPushNotification).not.toHaveBeenCalled();
  });

  it("valida destino same-origin relativo e dispara o serviço para Admin", async () => {
    const response = await request("/api/v2/admin/push/send", "POST", {
      title: "Novos eventos", body: "Confira a agenda", url: "/agenda", tag: "new-events",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, sent: 3, failed: 0, expired: 1 });
    expect(mocks.sendPushNotification).toHaveBeenCalledWith({ title: "Novos eventos", body: "Confira a agenda", url: "/agenda", tag: "new-events" });
    const invalid = await request("/api/v2/admin/push/send", "POST", { title: "Teste", body: "Corpo", url: "https://attacker.example" });
    expect(invalid.status).toBe(400);
  });
});
