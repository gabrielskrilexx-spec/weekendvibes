import { describe, expect, it, vi } from "vitest";

describe("Vercel serverless entrypoint", () => {
  it("exports an Express app without starting a listener", async () => {
    vi.stubEnv("VERCEL", "1");
    const module = await import("../api/index");

    expect(typeof module.default).toBe("function");
  });
});
