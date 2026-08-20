import { describe, expect, it, vi } from "vitest";
import { createStructuredEventRejection, fetchInstagramPosts, fetchInstagramStories, hasApprovedAgendaText, hasRegionalHashtag, INSTAGRAM_TARGETS, isWithinInstagramLookback, summarizeStructuredRejections, validateStructuredInstagramEvent } from "./instagram-pipeline";

describe("Instagram weekend pipeline", () => {
  it("accepts broad agenda signals without exact phrase or hashtag requirements", () => {
    expect(hasApprovedAgendaText("Agenda da semana\n#Sexta-Feira")).toBe(true);
    expect(hasApprovedAgendaText("Agenda semanal\n#Sexta-Feira")).toBe(true);
    expect(hasApprovedAgendaText("Agenda da semana\n#sexta-feira")).toBe(true);
    expect(hasApprovedAgendaText("Agenda da semana\n#Domingo")).toBe(true);
    expect(hasApprovedAgendaText("Confira novidades da casa")).toBe(true);
  });

  it("recognizes the regional hashtags without weakening the strict agenda filter", () => {
    expect(hasRegionalHashtag("Agenda da semana #Sexta-Feira #Guarujá")).toBe(true);
    expect(hasRegionalHashtag("Agenda da semana #Sábado #Santos")).toBe(true);
    expect(hasRegionalHashtag("Agenda da semana #Sábado #PraiaGrande")).toBe(false);
    expect(hasApprovedAgendaText("Agenda da semana #Sábado #Guarujá")).toBe(true);
  });

  it("records specific final validation reasons without exposing raw event content", () => {
    const reasons = validateStructuredInstagramEvent({
      title: "Evento de teste",
      summary: "Resumo",
      eventDate: "2026-08-19T22:00:00.000Z",
      locationName: "Local desconhecido",
      address: "Endereço não verificável",
      city: "São Paulo" as "Santos",
      category: "show",
      genre: "funk",
      priceCents: 0,
      imageUrl: "",
      sourceUrl: "http://example.com/post",
    }, [], new Date("2026-08-20T12:00:00.000Z"));
    expect(reasons).toEqual(expect.arrayContaining(["past_event", "outside_target_venue", "invalid_source_url"]));
    expect(summarizeStructuredRejections([{ index: 0, eventKey: "abc123", reasons, sourceUrlValid: false, eventDateValid: false, venueNormalized: "", cityNormalized: "", eventDateIso: null }])).toMatchObject({ past_event: 1, outside_target_venue: 1, invalid_source_url: 1 });
  });

  it("stores sanitized venue, city and ISO date diagnostics for rejected events", () => {
    const rejection = createStructuredEventRejection({
      title: "Evento",
      eventDate: "2026-08-19T22:00:00.000Z",
      locationName: "  Casa   do   Mar  ",
      city: "Guarujá",
      sourceUrl: "https://www.instagram.com/p/abc/",
    }, 2, ["past_event", "outside_target_venue"]);
    expect(rejection).toMatchObject({
      venueNormalized: "Casa do Mar",
      cityNormalized: "Guarujá",
      eventDateIso: "2026-08-19T22:00:00.000Z",
      eventDateValid: false,
      sourceUrlValid: true,
    });
  });

  it("accepts Ativa House when its Santos alias is active", () => {
    expect(validateStructuredInstagramEvent({
      title: "Ativa House",
      summary: "Show",
      eventDate: "2026-08-20T00:00:00.000Z",
      locationName: "Ativa House",
      address: "Santos",
      city: "Santos",
      category: "show",
      genre: "funk",
      priceCents: 0,
      imageUrl: "",
      sourceUrl: "https://www.instagram.com/p/ativa/",
    }, ["ativa house"], new Date("2026-08-20T12:00:00.000Z"))).toEqual([]);
  });

  it("accepts a future event from an allowed city, venue and Instagram URL", () => {
    expect(validateStructuredInstagramEvent({
      title: "Sexta musical",
      summary: "Show",
      eventDate: "2026-08-21T22:00:00.000Z",
      locationName: "Moby House",
      address: "Santos",
      city: "Santos",
      category: "show",
      genre: "funk",
      priceCents: 0,
      imageUrl: "",
      sourceUrl: "https://www.instagram.com/p/abc123/",
    }, [], new Date("2026-08-20T12:00:00.000Z"))).toEqual([]);
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
    process.env.INGESTION_FORCE_INSTAGRAM = "1";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 10, message: "Application does not have permission for this action" } }), { status: 400 }));
    try {
      await expect(fetchInstagramPosts()).rejects.toThrow("Meta Graph API request failed with 400");
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.INGESTION_FORCE_INSTAGRAM;
    }
  });
});
