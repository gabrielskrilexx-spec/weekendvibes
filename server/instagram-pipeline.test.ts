import { describe, expect, it, vi } from "vitest";
import { fetchInstagramPosts, fetchInstagramStories, hasApprovedAgendaText, hasRegionalHashtag, INSTAGRAM_TARGETS, isWithinInstagramLookback } from "./instagram-pipeline";

describe("Instagram weekend pipeline", () => {
  it("requires the exact agenda phrase and one allowed hashtag", () => {
    expect(hasApprovedAgendaText("Agenda da semana\n#Sexta-Feira")).toBe(true);
    expect(hasApprovedAgendaText("Agenda semanal\n#Sexta-Feira")).toBe(false);
    expect(hasApprovedAgendaText("Agenda da semana\n#sexta-feira")).toBe(false);
    expect(hasApprovedAgendaText("Agenda da semana\n#Domingo")).toBe(false);
  });

  it("recognizes the regional hashtags without weakening the strict agenda filter", () => {
    expect(hasRegionalHashtag("Agenda da semana #Sexta-Feira #Guarujá")).toBe(true);
    expect(hasRegionalHashtag("Agenda da semana #Sábado #Santos")).toBe(true);
    expect(hasRegionalHashtag("Agenda da semana #Sábado #PraiaGrande")).toBe(false);
    expect(hasApprovedAgendaText("Agenda da semana #Sábado #Guarujá")).toBe(true);
  });

  it("accepts only posts from the last five days", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    expect(isWithinInstagramLookback({ timestamp: "2026-08-10T12:00:00.000Z" }, now)).toBe(true);
    expect(isWithinInstagramLookback({ timestamp: "2026-08-06T11:59:59.000Z" }, now)).toBe(false);
    expect(isWithinInstagramLookback({ timestamp: "2026-08-13T00:00:00.000Z" }, now)).toBe(false);
  });

  it("keeps all configured accounts as official Meta Business Discovery targets", () => {
    expect(INSTAGRAM_TARGETS.map(target => target.username)).toEqual([
      "mobydicksantos", "projac.bar", "meulugar.bar", "nossoafterguaruja", "curvaosurfhouse",
      "flamingomusicbar", "rocketseaclub", "ativahouse",
    ]);
    expect(INSTAGRAM_TARGETS.every(target => target.directUrl.startsWith("https://www.instagram.com/"))).toBe(true);
  });

  it("requires the official Meta credentials and never falls back to public collection", async () => {
    delete process.env.META_INSTAGRAM_TOKEN;
    delete process.env.META_INSTAGRAM_ACCOUNT_ID;
    await expect(fetchInstagramPosts()).rejects.toThrow("Missing required environment variable: META_INSTAGRAM_TOKEN");
  });

  it("returns no Stories instead of using an undocumented or session-based collector", async () => {
    await expect(fetchInstagramStories()).resolves.toEqual([]);
  });

  it("propagates an official Graph API error instead of converting it to no data", async () => {
    const originalFetch = globalThis.fetch;
    process.env.META_INSTAGRAM_TOKEN = "test-meta-token";
    process.env.META_INSTAGRAM_ACCOUNT_ID = "17841438723866203";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 10, message: "Application does not have permission for this action" } }), { status: 400 }));
    try {
      await expect(fetchInstagramPosts()).rejects.toThrow("Meta Graph API request failed with 400");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
