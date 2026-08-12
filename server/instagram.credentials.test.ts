import { describe, expect, it } from "vitest";

describe("Instagram ingestion credentials", () => {
  it("validates the Apify token with a read-only identity request", async () => {
    const token = process.env.APIFY_API_TOKEN;
    expect(token, "APIFY_API_TOKEN must be configured").toBeTruthy();

    const response = await fetch(
      `https://api.apify.com/v2/users/me?token=${encodeURIComponent(token!)}`,
    );
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { data?: { id?: string } };
    expect(payload.data?.id).toBeTruthy();
  }, 20_000);

  it("validates the OpenAI key with a read-only model lookup", async () => {
    const token = process.env.OPENAI_API_KEY;
    expect(token, "OPENAI_API_KEY must be configured").toBeTruthy();

    const response = await fetch("https://api.openai.com/v1/models/gpt-4o-mini", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { id?: string };
    expect(payload.id).toBe("gpt-4o-mini");
  }, 20_000);
});
