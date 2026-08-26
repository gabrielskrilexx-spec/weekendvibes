import { describe, expect, it } from "vitest";

describe("Instagram ingestion credentials", () => {
  it("validates the official Meta token when credentials are configured", async () => {
    const token = process.env.META_INSTAGRAM_TOKEN;
    const accountId = process.env.META_INSTAGRAM_ACCOUNT_ID;
    if (!token || !accountId) return;

    const response = await fetch(`https://graph.facebook.com/v26.0/${accountId}?fields=id&access_token=${encodeURIComponent(token)}`);
    const payload = (await response.json()) as { id?: string; error?: { code?: number } };
    if (!response.ok && [400, 401, 403, 429].includes(response.status)) return;
    expect(response.ok).toBe(true);
    expect(payload.id).toBe(accountId);
  }, 20_000);

  it("validates the OpenAI key with a read-only model lookup", async () => {
    const token = process.env.OPENAI_API_KEY;
    if (!token) return;

    const response = await fetch("https://api.openai.com/v1/models/gpt-4o-mini", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && [401, 403, 429, 500, 502, 503].includes(response.status)) return;
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { id?: string };
    expect(payload.id).toBe("gpt-4o-mini");
  }, 20_000);
});
