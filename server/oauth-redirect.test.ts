import { describe, expect, it } from "vitest";
import { getSafeReturnPath } from "@shared/const";

describe("OAuth return path safety", () => {
  it("preserves an internal event path with query and hash", () => {
    expect(getSafeReturnPath("/eventos/festa?cidade=Santos#detalhes")).toBe(
      "/eventos/festa?cidade=Santos#detalhes",
    );
  });

  it("falls back for external and protocol-relative URLs", () => {
    expect(getSafeReturnPath("https://example.com/phishing")).toBe("/");
    expect(getSafeReturnPath("//example.com/phishing")).toBe("/");
  });

  it("falls back for malformed control characters and non-string input", () => {
    expect(getSafeReturnPath("/admin\\\\evil")).toBe("/");
    expect(getSafeReturnPath("/admin\u0000evil")).toBe("/");
    expect(getSafeReturnPath(null, "/agenda")).toBe("/agenda");
  });
});
