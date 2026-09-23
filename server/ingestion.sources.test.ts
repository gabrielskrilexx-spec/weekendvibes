import { describe, expect, it, vi } from "vitest";
import { filterDisabledPublicSourceUrls, getConfiguredSourceUrls } from "./ingestion";

describe("ingestion source configuration", () => {
  it("excludes URLs whose persisted public source is disabled", () => {
    expect(filterDisabledPublicSourceUrls([
      "https://www.ingresse.com/",
      "https://articket.com.br/",
    ], new Set(["public:ingresse"]))).toEqual(["https://articket.com.br/"]);
  });

  it("reads the configured public source URLs", () => {
    const focused = process.env.INGESTION_FOCUS_URLS;
    delete process.env.INGESTION_FOCUS_URLS;
    try {
      vi.stubEnv("INGESTION_SOURCE_URLS", "https://articket.com.br/,https://blacktag.com.br/");
      expect(getConfiguredSourceUrls()).toEqual(expect.arrayContaining([
        "https://articket.com.br/",
        "https://blacktag.com.br/",
        "https://www.ingresse.com/reveillon-guaruja-2027/",
        "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/",
      ]));
    } finally {
      vi.unstubAllEnvs();
      if (focused !== undefined) process.env.INGESTION_FOCUS_URLS = focused;
    }
  });
});


describe("JSON public source configuration", () => {
  it("does not leak brackets or quotes into configured URLs", () => {
    const focused = process.env.INGESTION_FOCUS_URLS;
    delete process.env.INGESTION_FOCUS_URLS;
    try {
      vi.stubEnv("INGESTION_SOURCE_URLS", JSON.stringify(["https://example.com/a", "https://example.com/b"]));
      const urls = getConfiguredSourceUrls();
      expect(urls).toContain("https://example.com/a");
      expect(urls).toContain("https://example.com/b");
      expect(urls.every(url => !/[\\[\\]\\\"']/.test(url))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      if (focused !== undefined) process.env.INGESTION_FOCUS_URLS = focused;
    }
  });
});

describe("public event discovery", () => {
  it("maps the public Ingresse API payload into a structured event page", async () => {
    const { fetchIngresseEventApi } = await import("./ingestion");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 104949,
      title: "Laroc Guarujá apresenta: Réveillon 2027 feat. Mau P",
      description: "<p>Open bar e música eletrônica.</p>",
      sessions: [{ dateTime: "2026-12-31T23:00:00+00:00", status: "available" }],
      place: { name: "Laroc Club Guarujá", city: "Guarujá", state: "SP", street: "Rodovia Ariovaldo de Almeida de Viana, S/n", location: { lat: -23.89409, lon: -46.18753 } },
      poster: { large: "https://kraken.ingresse.com/event/posters/104949/large.jpg" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await fetchIngresseEventApi("https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api-site.ingresse.com/events/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p"),
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestHeaders = new Headers(requestInit.headers);
    expect(requestHeaders.get("accept")).toBe("application/json");
    expect(requestHeaders.get("accept-language")).toBe("pt-BR,pt;q=0.9,en;q=0.8");
    expect(requestHeaders.get("cache-control")).toBe("no-cache");
    expect(requestHeaders.get("user-agent")).toBe("WeekendVibesPublicIngestion/1.1 (+public-event-ingestion)");
    expect(page.structured).toMatchObject({
      title: "Laroc Guarujá apresenta: Réveillon 2027 feat. Mau P",
      eventDate: "2026-12-31T23:00:00+00:00",
      locationName: "Laroc Club Guarujá",
      city: "Guarujá",
      latitude: "-23.89409",
      longitude: "-46.18753",
    });
    expect(page.text).toContain("música eletrônica");
    vi.unstubAllGlobals();
  });

  it("uses the last-known-good payload when the Ingresse API later fails", async () => {
    const { fetchIngresseEventApi } = await import("./ingestion");
    const url = "https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/";
    const payload = { title: "Réveillon 2027", summary: "Música eletrônica", eventDate: "2026-12-31T23:00:00+00:00", locationName: "Laroc Club Guarujá", address: "Guarujá", city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: url, imageUrl: "https://example.com/poster.jpg", latitude: "-23.89409", longitude: "-46.18753" };
    const cache = { cacheKey: "ingresse:laroc-guaruja-apresenta-reveillon-2027-feat-mau-p", sourceKey: "public:ingresse", sourceUrl: url, payload: JSON.stringify(payload), latitude: payload.latitude, longitude: payload.longitude };
    const cacheStore = { read: vi.fn().mockResolvedValue(cache), write: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("indisponível", { status: 503 })));
    const page = await fetchIngresseEventApi(url, cacheStore);
    expect(page.cacheFallback).toMatchObject({ used: true, status: 503 });
    expect(page.fetchFailure).toMatchObject({ status: 503 });
    expect(page.structured).toMatchObject({ title: "Réveillon 2027", locationName: "Laroc Club Guarujá", latitude: "-23.89409", longitude: "-46.18753" });
    expect(cacheStore.read).toHaveBeenCalledWith(cache.cacheKey);
    vi.unstubAllGlobals();
  });

  it("extracts Articket and Blacktag event links from source HTML", async () => {
    const { extractPublicEventLinks, containsTargetVenue } = await import("./ingestion");
    const html = '<a href="/e/123/show-verilonguinho">Show</a><a href="/eventos/456/moby-house">Moby</a><a href="https://example.com/outro">Outro</a>';
    expect(extractPublicEventLinks(html, "https://articket.com.br/")).toEqual(["https://articket.com.br/e/123/show-verilonguinho"]);
    expect(containsTargetVenue("Moby Dick, Santos - SP")).toBe(true);
    expect(containsTargetVenue("Laroc Club Guarujá")).toBe(true);
    expect(containsTargetVenue("Guarujá Golf Club")).toBe(true);
    expect(containsTargetVenue("Arena desconhecida, Santos - SP")).toBe(false);
    expect(containsTargetVenue("Flamingo Music Bar, Santos - SP", ["flamingo music bar"])).toBe(true);
    expect(containsTargetVenue("Arena desconhecida, Santos - SP", ["Outro local"])).toBe(false);
  });
});
