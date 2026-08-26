import { describe, expect, it } from "vitest";
import { getOAuthCallbackUri, getSafeReturnPath, normalizeOAuthRedirectUri } from "./const";

describe("OAuth redirect helpers", () => {
  it("normalizes only the numeric local host", () => {
    expect(getOAuthCallbackUri("http://127.0.0.1:3000")).toBe("http://localhost:3000/api/oauth/callback");
    expect(getOAuthCallbackUri("https://weekendvib-jscaalye.manus.space")).toBe("https://weekendvib-jscaalye.manus.space/api/oauth/callback");
  });

  it("rejects malformed or relative redirect origins", () => {
    expect(normalizeOAuthRedirectUri("/api/oauth/callback")).toBe("");
    expect(normalizeOAuthRedirectUri("not a url")).toBe("");
  });

  it("keeps redirect_to same-origin and falls back for external paths", () => {
    expect(getSafeReturnPath("/admin?tab=logs")).toBe("/admin?tab=logs");
    expect(getSafeReturnPath("https://evil.example")).toBe("/");
    expect(getSafeReturnPath("//evil.example")).toBe("/");
  });
});
