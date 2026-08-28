import { describe, expect, it } from "vitest";

describe("APIFY_API_TOKEN", () => {
  it("autentica no endpoint leve do Apify sem expor a credencial", async () => {
    const token = process.env.APIFY_API_TOKEN?.trim();
    expect(token, "APIFY_API_TOKEN precisa estar configurado para esta validação").toBeTruthy();

    const response = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token!)}`, {
      headers: { Accept: "application/json", "User-Agent": "WeekendVibes/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Apify credential validation failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as { data?: { username?: unknown } };
    expect(typeof body.data?.username).toBe("string");
  }, 20_000);
});

// This test intentionally validates only authentication metadata; it never starts an Actor or collects content.

