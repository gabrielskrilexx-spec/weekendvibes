import { describe, expect, it, beforeEach, vi } from "vitest";
import { eq, or } from "drizzle-orm";
import { ingestionSources } from "../drizzle/schema";
import { getDb } from "./db";
import { createStructuredEventRejection, fetchInstagramPosts, fetchInstagramPostsDetailed, getInstagramSessionGeneration, isInstagramTransportFailure, normalizeStructuredEventDate, fetchInstagramStories, fetchApifyStoriesAndHighlights, getApifySyncTimeoutMs, getApifyActorMaxRuntimeSecs, hasApprovedAgendaText, hasRegionalHashtag, INSTAGRAM_TARGETS, isWithinInstagramLookback, summarizeStructuredRejections, validateStructuredInstagramEvent, buildInstagramScraperPayload, buildInstagramStoriesScraperPayload, isAgendaHighlightTitle, normalizeInstagramMediaItem, normalizeInstagramMediaPayload, createMeuLugarSandboxStoryMock, extractOcrText, buildOcrAuditEntries, shouldExtractInstagramMediaOcr, resolveInstagramVisualUrl, extractStructuredEventsForTest } from "./instagram-pipeline";

describe("Instagram weekend pipeline", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.update(ingestionSources).set({ circuitState: "closed", circuitFailureCount: 0, circuitOpenedAt: null, circuitNextAttemptAt: null, circuitLastError: null }).where(or(eq(ingestionSources.sourceKey, "instagram:curvaosurfhouse"), eq(ingestionSources.sourceKey, "instagram:flamingomusicbar")));
  });
  it("limits the Stories Actor runtime and keeps the payload explicit", () => {
    const previous = process.env.APIFY_ACTOR_MAX_RUNTIME_SECS;
    try {
      delete process.env.APIFY_ACTOR_MAX_RUNTIME_SECS;
      expect(getApifyActorMaxRuntimeSecs()).toBe(45);
      process.env.APIFY_ACTOR_MAX_RUNTIME_SECS = "120";
      expect(getApifyActorMaxRuntimeSecs()).toBe(60);
      process.env.APIFY_ACTOR_MAX_RUNTIME_SECS = "5";
      expect(getApifyActorMaxRuntimeSecs()).toBe(20);
      expect(buildInstagramStoriesScraperPayload([{ username: "meulugar.bar" }])).toEqual({ targets: ["meulugar.bar"], scrapeType: "both", maxHighlights: 10, onlyNew: false });
    } finally {
      if (previous === undefined) delete process.env.APIFY_ACTOR_MAX_RUNTIME_SECS;
      else process.env.APIFY_ACTOR_MAX_RUNTIME_SECS = previous;
    }
  });

  it("sanitizes OCR audit entries for the administrative history", () => {
    const [entry] = buildOcrAuditEntries([{ post: { mediaType: "story", displayUrl: "https://cdn.example.com/story.jpg", url: "https://www.instagram.com/meulugar.bar/", ocrText: "Programação 22h", highlightTitle: "Programação" }, rawText: "Programação 22h\nSantos" }]);
    expect(entry).toEqual({ mediaOrigin: "story", imageUrl: "https://cdn.example.com/story.jpg", sourceUrl: "https://www.instagram.com/meulugar.bar/", highlightTitle: "Programação", ocrText: "Programação 22h", rawText: "Programação 22h\nSantos" });
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

  it("accepts an Instagram profile URL as a valid Story source", () => {
    expect(validateStructuredInstagramEvent({ sourceUrl: "https://www.instagram.com/meulugar.bar/" }, [], new Date("2026-08-28T12:00:00.000Z"))).not.toContain("invalid_source_url");
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

  it("builds the dedicated Stories Actor payload with the documented fields", () => {
    expect(buildInstagramStoriesScraperPayload([{ username: "meulugar.bar" }])).toEqual({
      targets: ["meulugar.bar"],
      scrapeType: "both",
      maxHighlights: 10,
      onlyNew: false,
    });
  });

  it("maps the documented Zaver media fields into the internal Story contract", () => {
    const [item] = normalizeInstagramMediaPayload([{ source_username: "meulugar.bar", item_type: "story", media_type: "video", video_url: "https://cdn.example.com/story.mp4", image_url: "https://cdn.example.com/story.jpg", taken_at: "2026-09-16T20:00:00.000Z", expiring_at: "2026-09-17T20:00:00.000Z", accessibility_caption: "Agenda 22h" }]);
    expect(item).toMatchObject({ username: "meulugar.bar", mediaType: "story", imageUrl: "https://cdn.example.com/story.jpg", postedAt: "2026-09-16T20:00:00.000Z", expiresAt: "2026-09-17T20:00:00.000Z", ocrText: "Agenda 22h", isVideo: true });
  });

  it("filters Highlights to agenda titles and normalizes Story media", () => {
    expect(isAgendaHighlightTitle("Programação")).toBe(true);
    expect(isAgendaHighlightTitle("Cardápio")).toBe(false);
    const story = normalizeInstagramMediaItem({ id: 1, type: "story", imageUrl: "https://img.example/story.jpg", username: "meulugar.bar" });
    expect(story).toMatchObject({ id: "1", mediaType: "story", ownerUsername: "meulugar.bar" });
    expect(normalizeInstagramMediaItem({ type: "highlight", title: "Cardápio", imageUrl: "https://img.example/menu.jpg" })).toBeNull();
    expect(normalizeInstagramMediaPayload({ items: [{ type: "highlight", title: "Agenda da semana", imageUrl: "https://img.example/agenda.jpg" }] })).toEqual([expect.objectContaining({ mediaType: "highlight", highlightTitle: "Agenda da semana" })]);
  });

  it("parses nested Story payloads returned by Apify without losing the media origin", () => {
    const posts = normalizeInstagramMediaPayload({ data: [{ username: "meulugar.bar", stories: [{ id: "story-1", display_url: "https://cdn.example.com/story.jpg", caption: "Hoje no Meu Lugar" }] }] });
    expect(posts).toEqual([expect.objectContaining({ id: "story-1", mediaType: "story", ownerUsername: "meulugar.bar", displayUrl: "https://cdn.example.com/story.jpg" })]);
  });

  it("clamps the Apify sync timeout to a safe configurable range", () => {
    const original = process.env.APIFY_SYNC_TIMEOUT_MS;
    process.env.APIFY_SYNC_TIMEOUT_MS = "12000";
    expect(getApifySyncTimeoutMs()).toBe(60000);
    process.env.APIFY_SYNC_TIMEOUT_MS = "45000";
    expect(getApifySyncTimeoutMs()).toBe(60000);
    process.env.APIFY_SYNC_TIMEOUT_MS = "75000";
    expect(getApifySyncTimeoutMs()).toBe(75000);
    process.env.APIFY_SYNC_TIMEOUT_MS = "120000";
    expect(getApifySyncTimeoutMs()).toBe(90000);
    if (original === undefined) delete process.env.APIFY_SYNC_TIMEOUT_MS; else process.env.APIFY_SYNC_TIMEOUT_MS = original;
  });

  it("maps the real Stories Actor schema and uses thumbnailUrl for video media", () => {
    const posts = normalizeInstagramMediaPayload([
      { type: "story", username: "meulugar.bar", mediaUrl: "https://cdn.example.com/story.jpg", postedAt: "2026-08-28T20:00:00-03:00", expiresAt: "2026-08-29T20:00:00-03:00" },
      { type: "story", isVideo: true, username: "curvaosurfhouse", mediaUrl: "https://cdn.example.com/story.mp4", thumbnailUrl: "https://cdn.example.com/story-thumb.jpg", postedAt: "2026-08-28T21:00:00-03:00", expiresAt: "2026-08-29T21:00:00-03:00" },
    ]);
    expect(posts).toEqual([
      expect.objectContaining({ mediaType: "story", ownerUsername: "meulugar.bar", url: "https://www.instagram.com/meulugar.bar/", displayUrl: "https://cdn.example.com/story.jpg", timestamp: "2026-08-28T20:00:00-03:00", postedAt: "2026-08-28T20:00:00-03:00", expiresAt: "2026-08-29T20:00:00-03:00" }),
      expect.objectContaining({ mediaType: "story", ownerUsername: "curvaosurfhouse", displayUrl: "https://cdn.example.com/story-thumb.jpg", thumbnailUrl: "https://cdn.example.com/story-thumb.jpg", isVideo: true }),
    ]);
    expect(resolveInstagramVisualUrl(posts[1]!)).toBe("https://cdn.example.com/story-thumb.jpg");
  });

  it("sends Story and Highlight images to OCR even when a caption exists", () => {
    expect(shouldExtractInstagramMediaOcr({ mediaType: "story" }, "Legenda curta", "https://cdn.example.com/story.jpg")).toBe(true);
    expect(shouldExtractInstagramMediaOcr({ mediaType: "highlight" }, "Agenda", "https://cdn.example.com/highlight.jpg")).toBe(true);
    expect(shouldExtractInstagramMediaOcr({ mediaType: "post" }, "Legenda curta", "https://cdn.example.com/post.jpg")).toBe(false);
    expect(shouldExtractInstagramMediaOcr({ mediaType: "post" }, "", "https://cdn.example.com/post.jpg")).toBe(true);
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

  it("envia URL pública diretamente ao Vision sem baixar a imagem para a RAM", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Sábado 22h Santos" } }] }), { status: 200, headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      await expect(extractOcrText("https://cdn.example.com/story.jpg")).resolves.toContain("Sábado");
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("https://cdn.example.com/story.jpg");
    } finally { globalThis.fetch = originalFetch; }
  });

  it("fragmenta a extração estruturada em lotes de 18 posts", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ events: [] }) } }] }), { status: 200, headers: { "content-type": "application/json" } })));
    const posts = Array.from({ length: 19 }, (_, index) => ({ post: { url: `https://www.instagram.com/p/post-${index}/`, ownerUsername: "meulugar.bar", mediaType: "story" as const }, rawText: `Evento ${index}` }));
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-openai-key";
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      await expect(extractStructuredEventsForTest("2026-09-18", posts)).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("Evento 17");
      expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain("Evento 18");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    }
  });

  it("classifies a global Apify timeout separately from a profile failure", async () => {
    const originalFetch = globalThis.fetch;
    const originalToken = process.env.APIFY_API_TOKEN;
    process.env.APIFY_API_TOKEN = "production-token-for-test";
    process.env.APIFY_SYNC_TIMEOUT_MS = "60000";
    globalThis.fetch = vi.fn().mockRejectedValue(Object.assign(new Error("The operation was aborted"), { name: "AbortError" })) as typeof fetch;
    try {
      const result = await fetchApifyStoriesAndHighlights({ dryRun: true });
      expect(result.transportFailures).toEqual([expect.objectContaining({ username: "apify-collector", status: 0, kind: "actor_timeout", message: "Timeout de conexão com o coletor Apify após 60000 ms." })]);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalToken === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = originalToken;
      delete process.env.APIFY_SYNC_TIMEOUT_MS;
    }
  });

  it("preserves the sanitized provider message for an Apify quota failure", async () => {
    const originalFetch = globalThis.fetch;
    const originalToken = process.env.APIFY_API_TOKEN;
    process.env.APIFY_API_TOKEN = "production-token-for-test";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { type: "platform-feature-disabled", message: "Monthly usage hard limit exceeded" } }), { status: 403, headers: { "content-type": "application/json" } })) as typeof fetch;
    try {
      const result = await fetchApifyStoriesAndHighlights({ dryRun: true });
      expect(result.posts).toEqual([]);
      expect(result.transportFailures).toEqual([expect.objectContaining({ status: 403, kind: "quota", message: "Cota mensal do Apify excedida; renove a quota ou injete um token com limite disponível." })]);
      expect(result.providerIssue).toEqual({ code: "APIFY_QUOTA_EXCEEDED", status: 403, message: "Cota mensal do Apify excedida; renove a quota ou injete um token com limite disponível." });
    } finally {
      globalThis.fetch = originalFetch;
      if (originalToken === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = originalToken;
    }
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
