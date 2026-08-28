import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasValidInternalCronSecret } from "./_core/cron-auth";

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
});
