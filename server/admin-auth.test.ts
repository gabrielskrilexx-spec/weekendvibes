import { afterEach, describe, expect, it } from "vitest";
import { isAdminUser } from "./_core/admin-auth";

describe("admin authorization policy", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("allows users with the persisted admin role", () => {
    expect(isAdminUser({ role: "admin", email: null })).toBe(true);
  });

  it("allows only configured administrator emails", () => {
    process.env.ADMIN_EMAILS = "other@example.com, weekendvibes.of@gmail.com";
    expect(isAdminUser({ role: "user", email: "WEEKENDVIBES.OF@GMAIL.COM" })).toBe(true);
    expect(isAdminUser({ role: "user", email: "visitor@example.com" })).toBe(false);
    expect(isAdminUser({ role: "user", email: null })).toBe(false);
  });

  it("denies every user when no email allowlist is configured", () => {
    expect(isAdminUser({ role: "user", email: "weekendvibes.of@gmail.com" })).toBe(false);
  });
});
