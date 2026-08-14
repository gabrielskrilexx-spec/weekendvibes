import { describe, expect, it } from "vitest";

describe("Meta Instagram credentials", () => {
  it("validates the configured token against the official lightweight /me endpoint", async () => {
    const token = process.env.META_INSTAGRAM_TOKEN;
    if (!token) return;

    const response = await fetch(
      `https://graph.facebook.com/v26.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`,
    );
    const payload = (await response.json()) as {
      id?: string;
      username?: string;
      error?: { message?: string };
    };

    expect(
      response.ok,
      payload.error?.message ?? `Instagram API returned HTTP ${response.status}`,
    ).toBe(true);
    expect(payload.id).toBeTruthy();
  }, 20_000);
});
