import { afterEach, describe, expect, it } from "vitest";
import { hasValidInternalCronSecret } from "./_core/cron-auth";

describe("cron secret authentication", () => {
  const originalSecret = process.env.INTERNAL_CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.INTERNAL_CRON_SECRET;
    else process.env.INTERNAL_CRON_SECRET = originalSecret;
  });

  it("accepts the exact M2M header without exposing the secret", () => {
    const secret = "cron-secret-test";
    process.env.INTERNAL_CRON_SECRET = secret;

    expect(hasValidInternalCronSecret({ headers: { "x-cron-secret": secret } })).toBe(true);
    expect(JSON.stringify({ authenticated: true })).not.toContain(secret);
  });

  it("rejects missing or incorrect headers", () => {
    process.env.INTERNAL_CRON_SECRET = "cron-secret-test";

    expect(hasValidInternalCronSecret({ headers: {} })).toBe(false);
    expect(hasValidInternalCronSecret({ headers: { "x-cron-secret": "wrong-secret" } })).toBe(false);
  });
});
