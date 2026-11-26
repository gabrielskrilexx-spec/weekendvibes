import { describe, expect, it, vi } from "vitest";
import { candidateUrl, classifyDiscoveryGenres, detectDiscoveryCity, DISCOVERY_REGIONAL_SOURCE_URLS, ensureDiscoveryPlatformStat, filterDiscoveryCandidateUrls, isFutureDiscoveryDate, pageToDiscoveryCandidate, resolveDiscoveryCityFromKnownVenue } from "./genre-discovery";
import { buildApifyCatalogPayload, extractEmbeddedPublicEventUrls, extractPublicEventLinks, extractSitemapUrls, extractZigApiEventUrls, fetchApifyCatalogLinks, getExploratoryApifyActorId, getExploratoryApifyCatalogUrls, isPublicCatalogUrl, isZigRegionalCatalogUrl, parseZigApiEventPayload, parseZigEventMetadata, shouldRunApifyCatalogFallback } from "./ingestion";

describe("Radar de descoberta por estilo", () => {
  it("classifica todos os gêneros que aparecem no conjunto de textos", () => {
    expect(classifyDiscoveryGenres({ title: "Trap & Rap", description: "Baile Funk com DJ e house eletrônica" })).toEqual(["trap", "rap", "funk", "eletrônica"]);
  });

  it("aceita exclusivamente Santos e Guarujá", () => {
    expect(detectDiscoveryCity("Evento no Espaço X, Santos - SP")).toBe("Santos");
    expect(detectDiscoveryCity("Evento no Espaço X, Guarujá - SP")).toBe("Guarujá");
    expect(detectDiscoveryCity("Evento no Espaço X, Praia Grande - SP")).toBeUndefined();
    expect(detectDiscoveryCity("Rio de Janeiro")).toBeUndefined();
  });

  it("rejeita datas passadas e aceita datas futuras", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(isFutureDiscoveryDate("2026-11-25T02:00:00-03:00", now)).toBe(true);
    expect(isFutureDiscoveryDate("2026-11-23T02:00:00-03:00", now)).toBe(false);
  });

  it("normaliza URL e registra os gêneros musicais reais no candidato", () => {
    const candidate = pageToDiscoveryCandidate({
      url: "https://www.sympla.com.br/evento/trap-rap-santos/123?utm_source=foo",
      text: "Trap Rap Santos; funk e house eletrônica, próximo sábado",
      imageUrl: "https://img.example/flyer.jpg",
      structured: { title: "Trap Rap Santos", startDate: "2026-12-05T23:00:00-03:00", city: "Santos", locationName: "Arena" },
    }, new Date("2026-11-24T12:00:00.000Z"));
    expect(candidate).toMatchObject({ canonicalUrl: "https://www.sympla.com.br/evento/trap-rap-santos/123", city: "Santos", flyerUrl: "https://img.example/flyer.jpg" });
    expect(candidate?.matchedGenres).toEqual(expect.arrayContaining(["trap", "rap", "funk", "eletrônica"]));
  });

  it("ignora Santos no rodapé quando o título identifica uma cidade externa", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    for (const title of ["Baile 80 em Curitiba", "Tasha & Tracie em Bauru"]) {
      expect(pageToDiscoveryCandidate({
        url: `https://articket.com.br/e/${title.replaceAll(" ", "-")}`,
        text: `${title} Ingressos e informações. Santos · Política de privacidade`,
        imageUrl: "",
        structured: { title, startDate: "2026-12-05T23:00:00-03:00", city: "Santos", locationName: "Casa de shows" },
      }, now)).toBeUndefined();
    }
  });

  it("não classifica comédia ou rock como eletrônica por causa de ingresso eletrônico", () => {
    expect(classifyDiscoveryGenres({ title: "KINGDOM NOITE DA COMÉDIA", description: "ingresso eletrônico, meia-entrada eletrônica" })).toEqual([]);
    expect(classifyDiscoveryGenres({ title: "ESPECIAL ACDC + Guns", description: "bilhete eletrônico e pagamento eletrônico" })).toEqual([]);
  });

  it("aprova candidatos reais de Santos e Guarujá nos estilos-alvo", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(pageToDiscoveryCandidate({
      url: "https://www.sympla.com.br/evento/paredao-tbt-santos-sp/3626596",
      text: "Paredão TBT | Santos/SP",
      imageUrl: "",
      structured: { title: "Paredão TBT | Santos/SP", startDate: "2026-11-29T00:00:00-03:00", city: "Santos", locationName: "Bujas Garagem Bar", description: "Baile Funk" },
    }, now)?.city).toBe("Santos");
    expect(pageToDiscoveryCandidate({
      url: "https://mringressos.com.br/comprar/493/baile-do-invictus",
      text: "Baile do Invictus Guarujá",
      imageUrl: "",
      structured: { title: "Baile do Invictus", startDate: "2026-12-11T23:00:00-03:00", city: "Guarujá", locationName: "Casa Guarujá", description: "Baile Funk" },
    }, now)?.city).toBe("Guarujá");
  });

  it("mantém URLs rejeitadas estáveis para bloqueio idempotente", () => {
    expect(candidateUrl("https://articket.com.br/e/123/festa?fbclid=tracking")).toBe("https://articket.com.br/e/123/festa");
  });

  it("não bloqueia candidato apenas porque sua URL está em ingestionSources", () => {
    const sourceUrl = "https://articket.com.br/e/999/evento-inedito?utm_source=radar";
    expect(filterDiscoveryCandidateUrls([sourceUrl], new Set(), new Set())).toEqual([
      "https://articket.com.br/e/999/evento-inedito",
    ]);
  });

  it("mantém bloqueados eventos já publicados ou já descobertos pelo Radar", () => {
    const published = "https://articket.com.br/e/100/publicado";
    const discovered = "https://sympla.com.br/evento/ja-descoberto/200";
    expect(filterDiscoveryCandidateUrls([published, discovered, "https://articket.com.br/e/101/novo"], new Set([published]), new Set([discovered]))).toEqual([
      "https://articket.com.br/e/101/novo",
    ]);
  });

  it("mantém sementes exploratórias de Santos e Guarujá para as bilheteiras suportadas", () => {
    expect(DISCOVERY_REGIONAL_SOURCE_URLS).toEqual(expect.arrayContaining([
      "https://www.sympla.com.br/eventos/santos-sp",
      "https://www.sympla.com.br/eventos/guaruja-sp",
      "https://zig.tickets/pt-BR?city=santos",
      "https://zig.tickets/pt-BR?city=guaruja",
      "https://blacktag.com.br/?city=santos",
      "https://blacktag.com.br/?city=guaruja",
      "https://articket.com.br/?city=santos",
      "https://articket.com.br/?city=guaruja",
      "https://blackpass.com.br/?city=santos",
      "https://blackpass.com.br/?city=guaruja",
      "https://gandaya.dance/?city=santos",
      "https://gandaya.dance/?city=guaruja",
      "https://mringressos.com.br/?cidade=santos",
      "https://mringressos.com.br/?cidade=guaruja",
      "https://www.weticket.com.br/?city=santos",
      "https://www.weticket.com.br/?city=guaruja",
    ]));
  });

  it("materializa public:gandaya no diagnóstico mesmo sem links retornados", () => {
    const stats: Array<{ platform: string; totalUrls: number; totalEvents: number; discardedByCity: number; discardedByGenre: number; duplicates: number; duplicateItems: Array<{ title: string; url: string }>; failures: number; emptyPages: number }> = [];
    const gandaya = ensureDiscoveryPlatformStat(stats, "public:gandaya");
    gandaya.apiStatus = "empty";
    gandaya.apiMessage = "Nenhum alias regional encontrado.";
    expect(stats).toEqual([expect.objectContaining({
      platform: "public:gandaya",
      apiStatus: "empty",
      apiMessage: expect.stringContaining("Nenhum alias"),
      funnel: { fetched: 0, parsed: 0, rejectedByCity: 0, rejectedByGenre: 0, rejectedByDate: 0, duplicate: 0, eligible: 0, persisted: 0, blocked: 0, empty: 0 },
      state: "ok",
    })]);
  });

  it("expande uma listagem Sympla sem tratar a própria listagem como evento", () => {
    const catalog = "https://www.sympla.com.br/eventos/guaruja-sp";
    const html = `<a href="/evento/baile-guaruja/123">Baile Trap Guarujá</a><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ events: [{ url: "https://www.sympla.com.br/evento/funk-guaruja/456" }] })}</script>`;
    expect(isPublicCatalogUrl(catalog)).toBe(true);
    expect(extractPublicEventLinks(html, catalog)).toEqual(expect.arrayContaining([
      "https://www.sympla.com.br/evento/baile-guaruja/123",
      "https://www.sympla.com.br/evento/funk-guaruja/456",
    ]));
    expect(extractPublicEventLinks(html, catalog)).not.toContain(catalog);
  });

  it("expande eventos Sympla a partir de resposta JSON de busca regional", () => {
    for (const city of ["santos", "guaruja"]) {
      const base = `https://www.sympla.com.br/eventos/${city}-sp`;
      const payload = JSON.stringify({ data: [{ url: `https://www.sympla.com.br/evento/baile-${city}/987` }, { canonicalUrl: `https://www.sympla.com.br/evento/rap-${city}/988` }] });
      expect(extractEmbeddedPublicEventUrls(payload, base)).toEqual(expect.arrayContaining([
        `https://www.sympla.com.br/evento/baile-${city}/987`,
        `https://www.sympla.com.br/evento/rap-${city}/988`,
      ]));
    }
  });

  it("extrai shell SPA da Zig usando OpenGraph quando o HTML não tem corpo", () => {
    const html = `<meta property="og:title" content="Baile Trap Laroc"><meta property="og:description" content="28/11/2026 às 23:00 · Laroc Club, Guarujá · Funk e Trap"><meta property="og:image" content="https://cdn.zig.tickets/laroc.jpg">`;
    expect(parseZigEventMetadata(html, "https://zig.tickets/eventos/baile-trap-laroc")).toMatchObject({
      title: "Baile Trap Laroc",
      city: "Guarujá",
      locationName: "Laroc Club",
      imageUrl: "https://cdn.zig.tickets/laroc.jpg",
    });
  });

  it("extrai evento Zig por payload JSON público quando o shell vem vazio", () => {
    const url = "https://zig.tickets/evento/baile-do-laroc";
    const payload = { id: 42, slug: "baile-do-laroc", name: "Baile do Laroc", description: "Funk e Trap no litoral", starts_at: "2026-12-05T23:00:00", timezone: "America/Sao_Paulo", url, images: { banner: "https://cdn.zig.tickets/laroc-banner.jpg" }, location: { name: "Laroc Club", city: "Guarujá", formatted_address: "Guarujá, SP" } };
    expect(parseZigApiEventPayload(payload, url)).toMatchObject({ title: "Baile do Laroc", city: "Guarujá", eventDate: "2026-12-05T23:00:00-03:00", imageUrl: "https://cdn.zig.tickets/laroc-banner.jpg" });
    expect(extractZigApiEventUrls({ data: [payload] })).toEqual([url]);
  });

  it("mantém o fallback Apify silencioso quando não há token", async () => {
    const token = process.env.APIFY_API_TOKEN;
    const actor = process.env.APIFY_CATALOG_ACTOR_ID;
    delete process.env.APIFY_API_TOKEN;
    delete process.env.APIFY_CATALOG_ACTOR_ID;
    try {
      await expect(fetchApifyCatalogLinks(["https://www.sympla.com.br/eventos/santos-sp"])).resolves.toMatchObject({ links: [], attempted: false, status: "not_configured" });
    } finally {
      if (token === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = token;
      if (actor === undefined) delete process.env.APIFY_CATALOG_ACTOR_ID; else process.env.APIFY_CATALOG_ACTOR_ID = actor;
    }
  });

  it("monta payload Apify com startUrls e pageFunction explícita para /evento/", () => {
    const payload = buildApifyCatalogPayload([
      "https://www.sympla.com.br/eventos/santos-sp",
      "https://www.sympla.com.br/eventos/guaruja-sp",
    ], "apify~puppeteer-scraper");
    expect(payload.startUrls).toEqual([
      { url: "https://www.sympla.com.br/eventos/santos-sp" },
      { url: "https://www.sympla.com.br/eventos/guaruja-sp" },
    ]);
    expect(payload.pageFunction).toContain("href");
    expect(payload.pageFunction).toContain("evento");
    expect(payload.pageFunction).toContain("title");
    expect(payload.maxConcurrency).toBe(2);
    expect(payload.maxRequestRetries).toBe(1);
    expect(payload.proxyConfiguration).toEqual({ useApifyProxy: true });
    expect(payload.pageFunction).toContain("try { await page.waitForSelector");
    expect(payload.pageFunction).toContain("bileto.sympla.com.br");
    expect(payload.pageFunction).toMatch(/\$\$eval\([^\n]+anchors => \{ const pattern = new RegExp/);
    expect(payload.pageFunction).toContain("debugTitle");
  });

  it("mantém URLs Bileto extraídas pelo Actor na validação do dataset", () => {
    const dataset = JSON.stringify([{ url: "https://bileto.sympla.com.br/event/baile-trap-123", title: "Baile Trap" }]);
    expect(extractEmbeddedPublicEventUrls(dataset, "https://www.sympla.com.br/eventos/santos-sp")).toEqual([
      "https://bileto.sympla.com.br/event/baile-trap-123",
    ]);
  });

  it("injeta os dois catálogos Sympla mesmo quando a fonte não está habilitada", () => {
    expect(getExploratoryApifyCatalogUrls()).toEqual([
      "https://www.sympla.com.br/eventos/santos-sp",
      "https://www.sympla.com.br/eventos/guaruja-sp",
    ]);
  });

  it("limita o scraper Apify de navegador aos dois catálogos Sympla", () => {
    const payload = buildApifyCatalogPayload([
      "https://www.sympla.com.br/eventos/santos-sp",
      "https://www.sympla.com.br/eventos/guaruja-sp",
      "https://blackpass.com.br/?city=santos",
      "https://gandaya.dance/?city=guaruja",
    ], "apify~puppeteer-scraper");
    expect(payload.startUrls).toEqual([
      { url: "https://www.sympla.com.br/eventos/santos-sp" },
      { url: "https://www.sympla.com.br/eventos/guaruja-sp" },
    ]);
    expect(payload.startUrls).not.toEqual(expect.arrayContaining([{ url: expect.stringContaining("blackpass") }]));
    expect(payload.startUrls).not.toEqual(expect.arrayContaining([{ url: expect.stringContaining("gandaya") }]));
  });

  it("usa Puppeteer por padrão no fallback exploratório do Sympla", async () => {
    const originalToken = process.env.APIFY_API_TOKEN;
    const originalActor = process.env.APIFY_CATALOG_ACTOR_ID;
    const originalWebActor = process.env.APIFY_WEB_ACTOR_ID;
    process.env.APIFY_API_TOKEN = "test-token";
    delete process.env.APIFY_CATALOG_ACTOR_ID;
    delete process.env.APIFY_WEB_ACTOR_ID;
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      expect(getExploratoryApifyActorId()).toBe("apify~puppeteer-scraper");
      await fetchApifyCatalogLinks(getExploratoryApifyCatalogUrls(), { actorId: getExploratoryApifyActorId() });
      const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(requestUrl).toContain("/acts/apify~puppeteer-scraper/");
      const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit)?.body));
      expect(body.startUrls).toEqual([
        { url: "https://www.sympla.com.br/eventos/santos-sp" },
        { url: "https://www.sympla.com.br/eventos/guaruja-sp" },
      ]);
    } finally {
      vi.unstubAllGlobals();
      if (originalToken === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = originalToken;
      if (originalActor === undefined) delete process.env.APIFY_CATALOG_ACTOR_ID; else process.env.APIFY_CATALOG_ACTOR_ID = originalActor;
      if (originalWebActor === undefined) delete process.env.APIFY_WEB_ACTOR_ID; else process.env.APIFY_WEB_ACTOR_ID = originalWebActor;
    }
  });

  it("expõe o debugTitle quando o Actor não encontra links", async () => {
    const originalToken = process.env.APIFY_API_TOKEN;
    const originalActor = process.env.APIFY_CATALOG_ACTOR_ID;
    process.env.APIFY_API_TOKEN = "test-token";
    process.env.APIFY_CATALOG_ACTOR_ID = "apify~puppeteer-scraper";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ debugTitle: "Verificação de segurança · Sympla" }]), { status: 200, headers: { "content-type": "application/json" } })));
    try {
      await expect(fetchApifyCatalogLinks(getExploratoryApifyCatalogUrls())).resolves.toMatchObject({
        status: "empty",
        message: expect.stringContaining("debugTitle: Verificação de segurança · Sympla"),
      });
    } finally {
      vi.unstubAllGlobals();
      if (originalToken === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = originalToken;
      if (originalActor === undefined) delete process.env.APIFY_CATALOG_ACTOR_ID; else process.env.APIFY_CATALOG_ACTOR_ID = originalActor;
    }
  });

  it("explica dataset Apify vazio sem inventar um título de página", async () => {
    const originalToken = process.env.APIFY_API_TOKEN;
    const originalActor = process.env.APIFY_CATALOG_ACTOR_ID;
    process.env.APIFY_API_TOKEN = "test-token";
    process.env.APIFY_CATALOG_ACTOR_ID = "apify~puppeteer-scraper";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
    try {
      await expect(fetchApifyCatalogLinks(getExploratoryApifyCatalogUrls())).resolves.toMatchObject({
        status: "empty",
        message: expect.stringContaining("dataset vazio"),
      });
    } finally {
      vi.unstubAllGlobals();
      if (originalToken === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = originalToken;
      if (originalActor === undefined) delete process.env.APIFY_CATALOG_ACTOR_ID; else process.env.APIFY_CATALOG_ACTOR_ID = originalActor;
    }
  });

  it("identifica somente as sementes Zig com cidade regional explícita", () => {
    expect(isZigRegionalCatalogUrl("https://zig.tickets/pt-BR?city=santos")).toBe(true);
    expect(isZigRegionalCatalogUrl("https://zig.tickets/pt-BR?city=guaruja")).toBe(true);
    expect(isZigRegionalCatalogUrl("https://zig.tickets/pt-BR")).toBe(false);
    expect(isZigRegionalCatalogUrl("https://zig.tickets/pt-BR?city=sao-paulo")).toBe(false);
  });

  it("mantém catálogos Sympla elegíveis ao Apify mesmo em cooldown exploratório", () => {
    const catalog = "https://www.sympla.com.br/eventos/santos-sp";
    expect(shouldRunApifyCatalogFallback(catalog, { circuitOpen: true }, { exploratoryApify: true })).toBe(true);
    expect(shouldRunApifyCatalogFallback(catalog, { circuitOpen: true }, {})).toBe(false);
  });

  it("aceita rotas /evento/, /eventos/, /e/ e /event/ no payload do Actor", () => {
    const payload = buildApifyCatalogPayload(["https://www.sympla.com.br/eventos/santos-sp"], "apify~cheerio-scraper");
    expect(payload.pageFunction).toContain("evento");
    expect(payload.pageFunction).toContain("eventos");
    expect(payload.pageFunction).toContain("(?:evento|eventos|e|event)");
    expect(payload.pageFunction).toContain("event");
    const dataset = JSON.stringify([
      { url: "https://www.sympla.com.br/evento/trap-santos/123", title: "Trap" },
      { url: "https://blacktag.com.br/eventos/baile-guaruja", title: "Baile" },
      { url: "https://articket.com.br/e/7522/kelvinho", title: "Kelvinho" },
      { url: "https://blackpass.com.br/event/funk-santos", title: "Funk" },
    ]);
    expect(extractEmbeddedPublicEventUrls(dataset, "https://www.sympla.com.br/eventos/santos-sp")).toEqual(expect.arrayContaining([
      "https://www.sympla.com.br/evento/trap-santos/123",
      "https://blacktag.com.br/eventos/baile-guaruja",
      "https://articket.com.br/e/7522/kelvinho",
      "https://blackpass.com.br/event/funk-santos",
    ]));
  });

  it("interpreta dataset Apify com objetos url/title e marca sucesso", async () => {
    const originalToken = process.env.APIFY_API_TOKEN;
    const originalActor = process.env.APIFY_CATALOG_ACTOR_ID;
    process.env.APIFY_API_TOKEN = "test-token";
    process.env.APIFY_CATALOG_ACTOR_ID = "apify~cheerio-scraper";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { url: "https://www.sympla.com.br/evento/trap-santos/123", title: "Trap Santos" },
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await fetchApifyCatalogLinks(["https://www.sympla.com.br/eventos/santos-sp"]);
      expect(result).toMatchObject({ links: ["https://www.sympla.com.br/evento/trap-santos/123"], attempted: true, status: "succeeded" });
      const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(request?.body));
      expect(body.startUrls).toEqual([{ url: "https://www.sympla.com.br/eventos/santos-sp" }]);
      expect(body.pageFunction).toContain("evento");
    } finally {
      vi.unstubAllGlobals();
      if (originalToken === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = originalToken;
      if (originalActor === undefined) delete process.env.APIFY_CATALOG_ACTOR_ID; else process.env.APIFY_CATALOG_ACTOR_ID = originalActor;
    }
  });

  it("resolve Santos ou Guarujá por uma casa conhecida sem addressLocality", () => {
    expect(resolveDiscoveryCityFromKnownVenue("Laroc Club Guarujá")).toBe("Guarujá");
    expect(resolveDiscoveryCityFromKnownVenue("Vallum Garden")).toBe("Santos");
    const candidate = pageToDiscoveryCandidate({
      url: "https://zig.tickets/eventos/trap-no-laroc",
      text: "Trap e Funk",
      imageUrl: "",
      structured: { title: "Trap no Laroc", startDate: "2026-12-05T23:00:00-03:00", locationName: "Laroc Club", description: "Funk e Trap" },
    }, new Date("2026-11-24T12:00:00.000Z"));
    expect(candidate?.city).toBe("Guarujá");
  });
  it("extrai eventos de __NEXT_DATA__ e ItemList JSON-LD", () => {
    const next = JSON.stringify({ props: { pageProps: { events: [{ name: "Trap Santos", url: "/evento/trap-santos/123" }] } } });
    const itemList = JSON.stringify({ "@type": "ItemList", itemListElement: [{ url: "https://www.sympla.com.br/evento/rap-guaruja/456" }] });
    const html = `<script id="__NEXT_DATA__" type="application/json">${next}</script><script type="application/ld+json">${itemList}</script>`;
    expect(extractEmbeddedPublicEventUrls(html, "https://www.sympla.com.br/eventos/santos-sp")).toEqual(expect.arrayContaining([
      "https://www.sympla.com.br/evento/trap-santos/123",
      "https://www.sympla.com.br/evento/rap-guaruja/456",
    ]));
  });

  it("extrai somente URLs de evento válidas de sitemap público", () => {
    const xml = `<urlset><url><loc>https://articket.com.br/e/7522/kelvinho</loc></url><url><loc>https://articket.com.br/termos</loc></url></urlset>`;
    expect(extractSitemapUrls(xml)).toEqual(["https://articket.com.br/e/7522/kelvinho"]);
  });
});
