import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";
import { applySecurityHeaders, createRateLimit, createStrictCors, redactError } from "./_core/security";
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

  it("limits requests with a retry hint and never exposes a token", () => {
    const middleware = createRateLimit({ windowMs: 60_000, max: 1, name: "test" });
    const response = createResponse();
    const request = { ip: "203.0.113.10" } as any;
    let nextCalls = 0;
    middleware(request, response as any, () => { nextCalls += 1; });
    middleware(request, response as any, () => { nextCalls += 1; });
    expect(nextCalls).toBe(1);
    expect(response.statusCode).toBe(429);
    expect(response.body).toEqual({ error: "too_many_requests" });
    expect(JSON.stringify(response.body)).not.toContain("token");
  });

  it("allows only configured or local origins and rejects wildcard CORS", () => {
    const middleware = createStrictCors();
    const allowed = createResponse();
    middleware({ headers: { origin: "http://localhost:3000" }, method: "GET" } as any, allowed as any, () => undefined);
    expect(allowed.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");

    const rejected = createResponse();
    middleware({ headers: { origin: "https://evil.example" }, method: "GET" } as any, rejected as any, () => undefined);
    expect(rejected.statusCode).toBe(403);
    expect(rejected.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("sets browser security headers and redacts internal errors", () => {
    const response = createResponse();
    applySecurityHeaders({ protocol: "https", headers: { "x-forwarded-proto": "https" } } as any, response as any);
    expect(response.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(response.headers["X-Frame-Options"]).toBe("DENY");
    expect(response.headers["Content-Security-Policy-Report-Only"]).toContain("frame-ancestors 'none'");
    expect(redactError(new Error("password=secret token=abc"))).toEqual({ name: "Error", code: "internal_error" });
  });

  function createResponse() {
    const headers: Record<string, string> = {};
    return {
      headers,
      statusCode: 200,
      body: undefined as unknown,
      setHeader(name: string, value: string) { headers[name] = value; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
      end() { return this; },
    };
  }
});

// Keep this file deterministic: it must not call external services or the database.
