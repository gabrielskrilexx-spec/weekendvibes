import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const claimedKeys = new Set<string>();
  const settings = {
    insert: vi.fn(() => ({
      values: vi.fn((row: { key: string }) => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (claimedKeys.has(row.key)) return [];
            claimedKeys.add(row.key);
            return [{ key: row.key }];
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  };
  return {
    claimedKeys,
    db: settings,
    getDb: vi.fn().mockResolvedValue(settings),
    queueWednesdayRoutineNow: vi.fn().mockResolvedValue({ accepted: true, runId: 9028, startedAt: "2026-10-30T00:00:00.000Z" }),
  };
});

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./manual-ingestion", () => ({ queueWednesdayRoutineNow: mocks.queueWednesdayRoutineNow }));

import { authenticateTemporaryIngestionRunner, temporaryIngestionRunnerHandler } from "./temporary-ingestion-runner";

let server: Server;
let baseUrl = "";
const token = "t".repeat(64);

async function post(authorization?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}/`, { method: "POST", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, json: await response.json() };
}

async function postRaw(authorization: string, body: string, contentType: string) {
  const response = await fetch(`${baseUrl}/`, { method: "POST", headers: { authorization, "content-type": contentType }, body });
  return { status: response.status, json: await response.json() };
}

describe("temporary production ingestion runner retry", () => {
  beforeAll(async () => {
    const app = express();
    app.post("/", authenticateTemporaryIngestionRunner, temporaryIngestionRunnerHandler);
    app.use(express.json());
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimedKeys.clear();
    mocks.getDb.mockResolvedValue(mocks.db);
    mocks.queueWednesdayRoutineNow.mockResolvedValue({ accepted: true, runId: 9028, startedAt: "2026-10-30T00:00:00.000Z" });
    process.env.WV_TEMPORARY_INGESTION_RUNNER_RETRY1_TOKEN_20261030 = token;
  });

  afterAll(async () => {
    delete process.env.WV_TEMPORARY_INGESTION_RUNNER_RETRY1_TOKEN_20261030;
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("requires the exact Bearer token and never starts an unauthorized run", async () => {
    const result = await post("Bearer wrong-token");
    expect(result.status).toBe(401);
    expect(result.json).toEqual({ error: "unauthorized" });
    expect(mocks.queueWednesdayRoutineNow).not.toHaveBeenCalled();
  });

  it("accepts one authenticated empty request and prevents replay even after token rotation", async () => {
    const result = await post(`Bearer ${token}`);
    expect(result.status).toBe(202);
    expect(result.json).toEqual({ accepted: true, runId: 9028, startedAt: "2026-10-30T00:00:00.000Z" });
    expect(mocks.queueWednesdayRoutineNow).toHaveBeenCalledWith({ forceApifyAll: true });
    const rotatedToken = "r".repeat(64);
    process.env.WV_TEMPORARY_INGESTION_RUNNER_RETRY1_TOKEN_20261030 = rotatedToken;
    const duplicate = await post(`Bearer ${rotatedToken}`);
    expect(duplicate.status).toBe(409);
    expect(duplicate.json).toEqual({ error: "runner_already_used" });
    expect(mocks.queueWednesdayRoutineNow).toHaveBeenCalledTimes(1);
  });

  it("rejects any non-empty body before queueing work", async () => {
    const objectPayload = await post(`Bearer ${token}`, { sources: ["https://example.invalid"] });
    const scalarPayload = await postRaw(`Bearer ${token}`, "42", "application/json");
    const textPayload = await postRaw(`Bearer ${token}`, "not-empty", "text/plain");
    for (const result of [objectPayload, scalarPayload, textPayload]) {
      expect(result.status).toBe(400);
      expect(result.json).toEqual({ error: "empty_body_required" });
    }
    expect(mocks.queueWednesdayRoutineNow).not.toHaveBeenCalled();
  });

  it("is not discoverable when the temporary token is unset", async () => {
    delete process.env.WV_TEMPORARY_INGESTION_RUNNER_RETRY1_TOKEN_20261030;
    const result = await post(`Bearer ${token}`);
    expect(result.status).toBe(404);
    expect(result.json).toEqual({ error: "not_found" });
    expect(mocks.queueWednesdayRoutineNow).not.toHaveBeenCalled();
  });
});
