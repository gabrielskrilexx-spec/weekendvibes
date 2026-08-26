import { describe, expect, it, vi } from "vitest";
import { ExternalFetchError, fetchExternal, isBlockedExternalResponse, readExternalBody, sanitizeExternalFetchError } from "./external-fetch";

describe("external fetch hardening", () => {
  it("adds browser-like headers and preserves a structured HTTP status", async () => {
    const response = new Response("blocked", { status: 403, headers: { "content-type": "text/html" } });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchExternal("https://example.test/events", { headers: { accept: "application/json" } }, 100, true);
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/events", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("user-agent")).toContain("WeekendVibesBot");
    expect(result.status).toBe(403);
    vi.unstubAllGlobals();
  });

  it("converts network failures and timeouts to sanitized errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(fetchExternal("https://example.test", {}, 100)).rejects.toMatchObject({ code: "NETWORK_ERROR", statusCode: null });
    expect(sanitizeExternalFetchError(new ExternalFetchError("Fonte externa respondeu HTTP 502", "HTTP_ERROR", 502))).toMatchObject({ code: "HTTP_ERROR", status: 502 });
    vi.unstubAllGlobals();
  });

  it("classifies blocked bodies without exposing their content", () => {
    expect(isBlockedExternalResponse(200, "<html><body>Cloudflare challenge</body></html>")).toBe(true);
    expect(isBlockedExternalResponse(502, "bad gateway")).toBe(true);
    expect(isBlockedExternalResponse(200, "evento público válido")).toBe(false);
  });

  it("returns a sanitized error when the response body cannot be read", async () => {
    const response = new Response(null, { status: 200 });
    Object.defineProperty(response, "text", { value: vi.fn().mockRejectedValue(new Error("socket closed")) });
    await expect(readExternalBody(response)).rejects.toMatchObject({ code: "NETWORK_ERROR", statusCode: 200 });
  });
});
