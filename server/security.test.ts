import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";
import { isSafeStorageKey } from "./_core/storageProxy";

describe("security boundaries", () => {
  it("uses secure cross-site cookies only for HTTPS requests", () => {
    expect(getSessionCookieOptions({ protocol: "https", headers: {} } as any)).toMatchObject({
      secure: true,
      sameSite: "none",
      httpOnly: true,
    });
    expect(getSessionCookieOptions({ protocol: "http", headers: {} } as any)).toMatchObject({
      secure: false,
      sameSite: "lax",
      httpOnly: true,
    });
  });

  it("rejects traversal and control characters in storage keys", () => {
    expect(isSafeStorageKey("events/poster.webp")).toBe(true);
    expect(isSafeStorageKey("../secrets.txt")).toBe(false);
    expect(isSafeStorageKey("events/\u0000poster.webp")).toBe(false);
    expect(isSafeStorageKey("a".repeat(513))).toBe(false);
  });
});

// Keep this file deterministic: it must not call external services or the database.
