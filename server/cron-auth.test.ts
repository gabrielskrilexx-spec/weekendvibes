import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasValidInternalCronSecret, requireInternalCron } from "./_core/cron-auth";

describe("internal cron authentication", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_CRON_SECRET", "cron-secret-test");
  });

  it("accepts the exact x-cron-secret header", () => {
    expect(hasValidInternalCronSecret({ headers: { "x-cron-secret": "cron-secret-test" } })).toBe(true);
  });

  it.each([
    {},
    { "x-cron-secret": "" },
    { "x-cron-secret": "wrong-secret" },
    { "x-cron-secret": "cron-secret-test-extra" },
  ])("rejects an invalid or missing header: %j", headers => {
    expect(hasValidInternalCronSecret({ headers })).toBe(false);
  });

  it("rejects every request when the server secret is absent", () => {
    vi.stubEnv("INTERNAL_CRON_SECRET", "");
    expect(hasValidInternalCronSecret({ headers: { "x-cron-secret": "cron-secret-test" } })).toBe(false);
  });

  it("returns 401 for a cookie-only request and does not call next", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    const next = vi.fn();
    requireInternalCron({ headers: { cookie: "app_session_id=valid-looking-cookie" } } as never, res, next);
    expect((res as any).status).toHaveBeenCalledWith(401);
    expect((res as any).json).toHaveBeenCalledWith({ ok: false, error: "unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("passes only the exact M2M header", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    const next = vi.fn();
    requireInternalCron({ headers: { "x-cron-secret": "cron-secret-test" } } as never, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect((res as any).status).not.toHaveBeenCalled();
  });
});
