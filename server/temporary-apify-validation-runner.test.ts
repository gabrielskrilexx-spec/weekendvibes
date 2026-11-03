import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  authenticateTemporaryApifyValidationRunner,
  getEligibleInstagramTargets,
  getTemporaryApifyPreflightFailure,
  hasUnexpectedRequestBody,
} from "./temporary-apify-validation-runner";

const TOKEN_ENV_KEY = "WV_TEMPORARY_APIFY_VALIDATION_TOKEN_20261103";

afterEach(() => {
  vi.unstubAllEnvs();
});

function invokeAuth(authorization?: string) {
  const req = { headers: authorization === undefined ? {} : { authorization } } as Request;
  let statusCode = 200;
  let payload: unknown;
  let nextCalls = 0;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { payload = body; return this; },
  } as unknown as Response;
  const next = (() => { nextCalls += 1; }) as NextFunction;
  authenticateTemporaryApifyValidationRunner(req, res, next);
  return { statusCode, payload, nextCalls };
}

const healthyPreflight = {
  killSwitchEnabled: false,
  sourceCount: 14,
  uniqueHandleCount: 14,
  supportedTargetCount: 14,
  activeRunCount: 0,
  budgetPersistent: true,
  remainingUnits: 100,
};

describe("temporary Apify validation runner auth", () => {
  it("hides the endpoint when its temporary secret is absent", () => {
    vi.stubEnv(TOKEN_ENV_KEY, "");
    expect(invokeAuth("Bearer invalid")).toMatchObject({ statusCode: 404, payload: { error: "not_found" }, nextCalls: 0 });
  });

  it("rejects invalid and oversized bearer tokens", () => {
    vi.stubEnv(TOKEN_ENV_KEY, "test-only-temporary-secret");
    expect(invokeAuth("Bearer invalid")).toMatchObject({ statusCode: 401, payload: { error: "unauthorized" }, nextCalls: 0 });
    expect(invokeAuth(`Bearer ${"x".repeat(5000)}`)).toMatchObject({ statusCode: 401, nextCalls: 0 });
  });

  it("accepts only the exact configured bearer token", () => {
    vi.stubEnv(TOKEN_ENV_KEY, "test-only-temporary-secret");
    expect(invokeAuth("Bearer test-only-temporary-secret")).toMatchObject({ statusCode: 200, nextCalls: 1 });
  });
});

describe("temporary Apify validation runner preflight", () => {
  it("rejects non-empty request bodies, but allows an empty POST", () => {
    expect(hasUnexpectedRequestBody({ headers: {}, body: undefined } as Request)).toBe(false);
    expect(hasUnexpectedRequestBody({ headers: { "content-length": "2" }, body: {} } as Request)).toBe(true);
    expect(hasUnexpectedRequestBody({ headers: { "transfer-encoding": "chunked" }, body: undefined } as Request)).toBe(true);
  });

  it("selects only enabled handles supported by the Actor target catalog", () => {
    expect(getEligibleInstagramTargets([
      { handle: "@mobydicksantos/" },
      { handle: "not-a-supported-target" },
    ])).toMatchObject([{ username: "mobydicksantos" }]);
  });

  it("allows only the expected 14-target set with persistent budget and no active run", () => {
    expect(getTemporaryApifyPreflightFailure(healthyPreflight)).toBeNull();
  });

  it("blocks the kill switch, changed target set, active run, and insufficient or unpersisted budget", () => {
    expect(getTemporaryApifyPreflightFailure({ ...healthyPreflight, killSwitchEnabled: true })).toMatchObject({ error: "apify_kill_switch_active" });
    expect(getTemporaryApifyPreflightFailure({ ...healthyPreflight, supportedTargetCount: 13 })).toMatchObject({ error: "instagram_target_set_changed" });
    expect(getTemporaryApifyPreflightFailure({ ...healthyPreflight, activeRunCount: 1 })).toMatchObject({ error: "instagram_apify_run_already_active" });
    expect(getTemporaryApifyPreflightFailure({ ...healthyPreflight, remainingUnits: 13 })).toMatchObject({ error: "apify_budget_unavailable_or_insufficient", requiredUnits: 14 });
    expect(getTemporaryApifyPreflightFailure({ ...healthyPreflight, budgetPersistent: false })).toMatchObject({ error: "apify_budget_unavailable_or_insufficient", remainingUnits: null });
  });
});
