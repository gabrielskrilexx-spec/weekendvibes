import { describe, expect, it, beforeEach, vi } from "vitest";
import { eq, or } from "drizzle-orm";
import { ingestionSources } from "../drizzle/schema";
import { getDb } from "./db";
import { createStructuredEventRejection, fetchInstagramPosts, fetchInstagramPostsDetailed, getInstagramSessionGeneration, isInstagramTransportFailure, normalizeStructuredEventDate, fetchInstagramStories, hasApprovedAgendaText, hasRegionalHashtag, INSTAGRAM_TARGETS, isWithinInstagramLookback, summarizeStructuredRejections, validateStructuredInstagramEvent, buildInstagramScraperPayload, isAgendaHighlightTitle, normalizeInstagramMediaItem, normalizeInstagramMediaPayload, createMeuLugarSandboxStoryMock, extractOcrText } from "./instagram-pipeline";

describe("Instagram weekend pipeline", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.update(ingestionSources).set({ circuitState: "closed", circuitFailureCount: 0, circuitOpenedAt: null, circuitNextAttemptAt: null, circuitLastError: null }).where(or(eq(ingestionSources.sourceKey, "instagram:curvaosurfhouse"), eq(ingestionSources.sourceKey, "instagram:flamingomusicbar")));
  });
  it("preserves the Sao Paulo civil day for date-only structured events", () => {
    expect(normalizeStructuredEventDate("2026-08-20").toISOString()).toBe("2026-08-20T15:00:00.000Z");
  });

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

  it("builds an Apify payload with Stories and Highlights enabled", () => {
    const payload = buildInstagramScraperPayload([{ username: "meulugar.bar", directUrl: "https://www.instagram.com/meulugar.bar/" }]);
    expect(payload).toMatchObject({ stories: true, highlights: true, includeStories: true, includeHighlights: true, usernames: ["meulugar.bar"] });
  });

  it("filters Highlights to agenda titles and normalizes Story media", () => {
    expect(isAgendaHighlightTitle("Programação")).toBe(true);
    expect(isAgendaHighlightTitle("Cardápio")).toBe(false);
    const story = normalizeInstagramMediaItem({ id: 1, type: "story", imageUrl: "https://img.example/story.jpg", username: "meulugar.bar" });
    expect(story).toMatchObject({ id: "1", mediaType: "story", ownerUsername: "meulugar.bar" });
    expect(normalizeInstagramMediaItem({ type: "highlight", title: "Cardápio", imageUrl: "https://img.example/menu.jpg" })).toBeNull();
    expect(normalizeInstagramMediaPayload({ items: [{ type: "highlight", title: "Agenda da semana", imageUrl: "https://img.example/agenda.jpg" }] })).toEqual([expect.objectContaining({ mediaType: "highlight", highlightTitle: "Agenda da semana" })]);
  });

  it("creates a valid Meu Lugar sandbox Story with OCR text for Vision", () => {
    const story = createMeuLugarSandboxStoryMock("2030-08-14");
    expect(story).toMatchObject({ ownerUsername: "meulugar.bar", mediaType: "story", displayUrl: expect.stringMatching(/^https:\/\//), ocrText: expect.stringContaining("Programação") });
  });

  it("sends Story artwork to Vision and returns the OCR text", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Meu Lugar · Sexta · 22h · Santos" } }] }), { status: 200, headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      await expect(extractOcrText("data:image/png;base64,AA==")).resolves.toContain("Meu Lugar");
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("chat/completions"), expect.objectContaining({ method: "POST", body: expect.stringContaining("image_url") }));
    } finally { globalThis.fetch = originalFetch; }
  });

  it("returns no remote Stories when the optional Apify token is absent", async () => {
    const originalToken = process.env.APIFY_API_TOKEN;
    delete process.env.APIFY_API_TOKEN;
    try { await expect(fetchInstagramStories()).resolves.toEqual([]); }
    finally { if (originalToken) process.env.APIFY_API_TOKEN = originalToken; }
  });

  it("classifies only supported transport/session failures for graceful degradation", () => {
    expect(isInstagramTransportFailure(403, "Forbidden")).toBe(true);
    expect(isInstagramTransportFailure(502, "invalid proxy response")).toBe(true);
    expect(isInstagramTransportFailure(400, "permission denied")).toBe(false);
  });

  it("resets the request context and continues across profiles on 403/502", async () => {
    const originalFetch = globalThis.fetch;
    process.env.META_INSTAGRAM_TOKEN = "test-meta-token";
    process.env.META_INSTAGRAM_ACCOUNT_ID = "17841438723866203";
    process.env.INGESTION_FORCE_INSTAGRAM = "1";
    process.env.INGESTION_FOCUS_INSTAGRAM = "curvaosurfhouse";
    const before = getInstagramSessionGeneration();
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "invalid proxy response" } }), { status: 403 }));
    try {
      const forbidden = await fetchInstagramPostsDetailed();
      expect(forbidden.posts).toEqual([]);
      expect(forbidden.transportFailures).toEqual(expect.arrayContaining([expect.objectContaining({ status: 403, kind: "proxy_or_session" })]));
      process.env.INGESTION_FOCUS_INSTAGRAM = "flamingomusicbar";
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "invalid proxy response" } }), { status: 502 }));
      const badGateway = await fetchInstagramPostsDetailed();
      expect(badGateway.posts).toEqual([]);
      expect(badGateway.transportFailures).toEqual(expect.arrayContaining([expect.objectContaining({ status: 502, kind: "proxy_or_session" })]));
      expect(getInstagramSessionGeneration()).toBeGreaterThan(before);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.INGESTION_FORCE_INSTAGRAM;
      delete process.env.INGESTION_FOCUS_INSTAGRAM;
    }
  });

  it("propagates an official Graph API error instead of converting it to no data", async () => {
    const originalFetch = globalThis.fetch;
    process.env.META_INSTAGRAM_TOKEN = "test-meta-token";
    process.env.META_INSTAGRAM_ACCOUNT_ID = "17841438723866203";
    process.env.INGESTION_FORCE_INSTAGRAM = "1";
    process.env.INGESTION_FOCUS_INSTAGRAM = "projac.bar";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 10, message: "Application does not have permission for this action" } }), { status: 400 }));
    try {
      await expect(fetchInstagramPosts()).rejects.toThrow("Meta Graph API request failed with 400");
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.INGESTION_FORCE_INSTAGRAM;
      delete process.env.INGESTION_FOCUS_INSTAGRAM;
    }
  }, 15000);
});
