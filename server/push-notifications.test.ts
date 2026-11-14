import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deletePushSubscription: vi.fn(),
  listPushSubscriptions: vi.fn(),
  upsertPushSubscription: vi.fn(),
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("./db", () => ({
  deletePushSubscription: mocks.deletePushSubscription,
  listPushSubscriptions: mocks.listPushSubscriptions,
  upsertPushSubscription: mocks.upsertPushSubscription,
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}));

import {
  isAllowedPushEndpoint,
  PushServiceConfigurationError,
  removePushSubscription,
  savePushSubscription,
  sendPushNotification,
} from "./push-notifications";

const originalEnv = {
  publicKey: process.env.VITE_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
};

function setEnv(values: { publicKey?: string; privateKey?: string; subject?: string }) {
  if (values.publicKey === undefined) delete process.env.VITE_VAPID_PUBLIC_KEY;
  else process.env.VITE_VAPID_PUBLIC_KEY = values.publicKey;
  if (values.privateKey === undefined) delete process.env.VAPID_PRIVATE_KEY;
  else process.env.VAPID_PRIVATE_KEY = values.privateKey;
  if (values.subject === undefined) delete process.env.VAPID_SUBJECT;
  else process.env.VAPID_SUBJECT = values.subject;
}

describe("Web Push service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv({ publicKey: "public-vapid", privateKey: "private-vapid", subject: "mailto:admin@weekendvibes.com" });
    mocks.listPushSubscriptions.mockResolvedValue([]);
    mocks.deletePushSubscription.mockResolvedValue(1);
    mocks.upsertPushSubscription.mockResolvedValue(undefined);
    mocks.setVapidDetails.mockImplementation(() => undefined);
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 });
  });
  afterEach(() => setEnv(originalEnv));

  it("aceita apenas origens HTTPS conhecidas de push providers", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/example")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/example")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/example")).toBe(false);
    expect(isAllowedPushEndpoint("https://attacker.example/metadata")).toBe(false);
  });

  it("faz upsert no backend com campos de criptografia", async () => {
    await savePushSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/example", keys: { p256dh: "public-key", auth: "auth-key" } });
    expect(mocks.upsertPushSubscription).toHaveBeenCalledWith({ endpoint: "https://fcm.googleapis.com/fcm/send/example", p256dh: "public-key", auth: "auth-key" });
  });

  it("remove subscription de forma idempotente e recusa endpoints não confiáveis", async () => {
    await removePushSubscription("https://fcm.googleapis.com/fcm/send/example");
    expect(mocks.deletePushSubscription).toHaveBeenCalledWith("https://fcm.googleapis.com/fcm/send/example");
    await expect(removePushSubscription("https://127.0.0.1/admin")).rejects.toThrow("invalid_push_endpoint");
    expect(mocks.deletePushSubscription).toHaveBeenCalledTimes(1);
  });

  it("não tenta enviar sem todas as variáveis VAPID", async () => {
    setEnv({ publicKey: "", privateKey: "private-vapid", subject: "mailto:admin@weekendvibes.com" });
    await expect(sendPushNotification({ title: "Teste", body: "Corpo", url: "/agenda" })).rejects.toBeInstanceOf(PushServiceConfigurationError);
    expect(mocks.setVapidDetails).not.toHaveBeenCalled();
    expect(mocks.listPushSubscriptions).not.toHaveBeenCalled();
  });

  it("envia payload para inscrições e informa contadores sem revelar endpoints", async () => {
    mocks.listPushSubscriptions.mockResolvedValue([
      { endpoint: "https://fcm.googleapis.com/fcm/send/one", p256dh: "p256dh-1", auth: "auth-1" },
      { endpoint: "https://web.push.apple.com/two", p256dh: "p256dh-2", auth: "auth-2" },
    ]);
    const result = await sendPushNotification({ title: "Novos eventos", body: "Veja a agenda", url: "/agenda", tag: "new-events" });
    expect(mocks.setVapidDetails).toHaveBeenCalledWith("mailto:admin@weekendvibes.com", "public-vapid", "private-vapid");
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://fcm.googleapis.com/fcm/send/one", keys: { p256dh: "p256dh-1", auth: "auth-1" } },
      JSON.stringify({ title: "Novos eventos", body: "Veja a agenda", url: "/agenda", tag: "new-events" }),
      { TTL: 3600, urgency: "high" },
    );
    expect(result).toEqual({ sent: 2, failed: 0, expired: 0 });
    expect(JSON.stringify(result)).not.toContain("fcm.googleapis.com");
  });

  it("remove inscrição expirada (404/410) e continua processando as demais", async () => {
    mocks.listPushSubscriptions.mockResolvedValue([
      { endpoint: "https://fcm.googleapis.com/fcm/send/expired", p256dh: "p256dh-1", auth: "auth-1" },
      { endpoint: "https://fcm.googleapis.com/fcm/send/active", p256dh: "p256dh-2", auth: "auth-2" },
    ]);
    mocks.sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 })).mockResolvedValueOnce({ statusCode: 201 });
    const result = await sendPushNotification({ title: "Teste", body: "Corpo", url: "/agenda" });
    expect(mocks.deletePushSubscription).toHaveBeenCalledWith("https://fcm.googleapis.com/fcm/send/expired");
    expect(result).toEqual({ sent: 1, failed: 0, expired: 1 });
  });
});
