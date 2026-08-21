import { describe, expect, it } from "vitest";

describe("public app version", () => {
  it("keeps the configured version tag and serves the lightweight app endpoint", async () => {
    expect(process.env.VITE_APP_VERSION).toBe("4a464f29");

    const response = await fetch("http://127.0.0.1:3000/", {
      headers: { "x-app-version": process.env.VITE_APP_VERSION },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBeLessThan(500);
  });
});
