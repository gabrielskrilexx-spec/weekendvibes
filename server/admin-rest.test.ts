import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest, deleteLocationAlias, deleteEvents, updateEventsPublication, runIngestionSourceChunk } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  deleteLocationAlias: vi.fn(),
  deleteEvents: vi.fn(),
  updateEventsPublication: vi.fn(),
  runIngestionSourceChunk: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./db", () => ({ deleteLocationAlias, deleteEvents, updateEventsPublication }));
vi.mock("./manual-ingestion", () => ({ runIngestionSourceChunk }));

import { registerAdminRestRoutes } from "./admin-rest";

let server: Server;
let baseUrl = "";

async function post(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

describe("admin REST actions", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerAdminRestRoutes(app);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticateRequest.mockResolvedValue({ role: "admin" });
    deleteLocationAlias.mockResolvedValue(undefined);
    deleteEvents.mockResolvedValue({ deleted: 2, deletedIds: [11, 12] });
    updateEventsPublication.mockResolvedValue({ updated: 2, ids: [11, 12] });
    runIngestionSourceChunk.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it.each([
    ["/api/admin/sync-stories", {}, { success: true }],
    ["/api/admin/remove-alias", { id: 7 }, { success: true, deletedId: "7" }],
    ["/api/admin/remove-events", { ids: [11, 12] }, { success: true, count: 2, ids: ["11", "12"] }],
    ["/api/admin/approve-events", { ids: [11, 12] }, { success: true, count: 2, ids: ["11", "12"] }],
    ["/api/admin/resolve-collision", { ids: [11, 12] }, { success: true, count: 2, ids: ["11", "12"] }],
  ])("returns a strict JSON payload for %s", async (path, body, expected) => {
    const result = await post(path, body);
    expect(result.status).toBe(200);
    expect(result.json).toEqual(expected);
  });

  it("returns a sandbox acknowledgement when Stories processing fails", async () => {
    runIngestionSourceChunk.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await post("/api/admin/sync-stories", {});
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ success: true, status: "SANDBOX_RESTRICTED" });
  });
});
