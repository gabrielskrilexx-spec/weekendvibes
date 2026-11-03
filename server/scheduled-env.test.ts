import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction } from "express";
import { requireInternalCron } from "./_core/cron-auth";
import { scheduledHealthHandler } from "./scheduled-health";

type FakeRequest = { headers: Record<string, string | undefined> };
type FakeResponse = {
  statusCode: number;
  body?: unknown;
  headers: Record<string, string>;
  status(code: number): FakeResponse;
  json(value: unknown): FakeResponse;
};

function createResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    headers: {},
    status(code) { response.statusCode = code; return response; },
    json(value) { response.body = value; response.headers["content-type"] = "application/json; charset=utf-8"; return response; },
  };
  return response;
}

function invokeScheduledHealth(req: FakeRequest, res: FakeResponse) {
  let nextCalled = false;
  const next: NextFunction = () => { nextCalled = true; };
  requireInternalCron(req as never, res as never, next);
  if (nextCalled) scheduledHealthHandler(req as never, res as never);
  return res;
}

describe("scheduled runtime environment", () => {
  beforeEach(() => {
    vi.stubEnv("SCHEDULED_TASK_ENDPOINT_BASE", "https://scheduled-test.invalid");
    vi.stubEnv("INTERNAL_CRON_SECRET", "test-internal-cron-secret");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("responde diretamente ao endpoint agendado sem rede nem cookie de sessão", () => {
    expect(process.env.SCHEDULED_TASK_ENDPOINT_BASE).toBe("https://scheduled-test.invalid");
    const response = invokeScheduledHealth({ headers: {} }, createResponse());
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "unauthorized" });

    const authenticatedResponse = invokeScheduledHealth({ headers: { "x-cron-secret": process.env.INTERNAL_CRON_SECRET } }, createResponse());
    expect(authenticatedResponse.headers["content-type"]).toContain("application/json");
    expect(authenticatedResponse.statusCode).toBe(200);
    expect(authenticatedResponse.body).toEqual(expect.objectContaining({ ok: true, service: "weekendvibes-api", checkedAt: expect.any(String) }));
  });

  it("aceita o segredo de máquina configurado no callback de saúde cron", () => {
    expect(process.env.SCHEDULED_TASK_ENDPOINT_BASE).toBeTruthy();
    expect(process.env.INTERNAL_CRON_SECRET).toBeTruthy();
    const response = invokeScheduledHealth({ headers: { "x-cron-secret": process.env.INTERNAL_CRON_SECRET } }, createResponse());
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ ok: true }));
  });
});
