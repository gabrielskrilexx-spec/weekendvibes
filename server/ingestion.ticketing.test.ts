import { describe, expect, it } from "vitest";
import { BLACKPASS_FETCH_TIMEOUT_MS, BLUE_MED_FETCH_TIMEOUT_MS, containsTargetVenue, EVENTOS_LITORAL_FETCH_TIMEOUT_MS, extractMrIngressosListingEvents, extractPublicEventLinks, getIngresseFetchTimeoutMs, PARQUE_VALONGO_FETCH_TIMEOUT_MS, parseArticketEventMetadata, parseBlackPassCatalogEvent, parseBlackPassEventMetadata, parseBlueMedAgendaEvents, parseEventosLitoralOrganizerMetadata, parseMrIngressosEventMetadata, parseParqueValongoEventMetadata, parseSymplaEventMetadata, parseTicket360EventMetadata, parseTicketingEventMetadata, parseWeTicketEventMetadata, publicSourceKey, SYMPLA_FETCH_TIMEOUT_MS, WETICKET_FETCH_TIMEOUT_MS } from "./ingestion";

describe("adapters de ticketeiras oficiais", () => {
  it("normaliza o payload embutido do Ticket360 e classifica Casa Grande", () => {
    const html = String.raw`<script>self.__next_f.push([1,"...\\"ev\\":{\\"id\\":\\"34199\\",\\"title\\":\\"Festa do Hawaii\\",\\"venue\\":\\"Casa Grande Hotel Resort \\u0026 Spa\\",\\"city\\":\\"Guarujá\\",\\"date\\":\\"2026-11-21\\",\\"doorsTime\\":\\"19h30\\",\\"image\\":\\"https://images.ticket360.com.br/hawaii.webp\\"}"])</script><h1>Festa do Hawaii</h1>`;
    expect(parseTicket360EventMetadata(html, "https://www.ticket360.com.br/evento/34199/ingressos-para-festa-do-hawaii/ingressos")).toMatchObject({
      title: "Festa do Hawaii",
      eventDate: "2026-11-21T19:30:00-03:00",
      locationName: "Casa Grande Hotel Resort & Spa",
      city: "Guarujá",
      category: "balada",
      genre: "house_eletronica",
    });
    expect(publicSourceKey("https://www.ticket360.com.br/evento/34199/ingressos-para-festa-do-hawaii/ingressos")).toBe("public:ticket360");
    expect(containsTargetVenue("Casa Grande Hotel Resort & Spa, Guarujá", ["casa grande hotel resort"])).toBe(true);
  });

  it("normaliza metadados públicos do Black Pass", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Event",
      name: "Jungle Room • Pink Edition",
      startDate: "2026-09-04T23:00:00-03:00",
      location: { name: "GOAT CLUB", address: { addressLocality: "Santos", streetAddress: "Rua Example, 100" } },
      offers: { price: 80 },
    })}</script><meta property="og:image" content="https://api.blackpass.com.br/web/events/goat.jpg">`;
    const parsed = parseBlackPassEventMetadata(html, "https://blackpass.com.br/event/700");
    expect(parsed).toMatchObject({ title: "Jungle Room • Pink Edition", eventDate: "2026-09-04T23:00:00-03:00", locationName: "GOAT CLUB", city: "Santos", priceCents: 8000, sourceUrl: "https://blackpass.com.br/event/700" });
  });

  it("normaliza item do catálogo JSON público do Black Pass", () => {
    const parsed = parseBlackPassCatalogEvent({
      id: 700,
      title: "Jungle Room - Pink Edition",
      address: "Rua do Comércio, 63",
      address_comp: "GOAT CLUB",
      latlng: "-23.9325438,-46.3318910",
      dates: [{ dstart: "2026-09-05T02:00:00.000Z", dstop: "2026-09-05T02:00:00.000Z", status: 1 }],
      poster: { poster_vertical: "/web/events/jungle.jpg" },
    });
    expect(parsed).toMatchObject({ title: "Jungle Room - Pink Edition", locationName: "GOAT CLUB", city: "Santos", latitude: "-23.9325438", longitude: "-46.3318910", sourceUrl: "https://blackpass.com.br/event/700" });
  });

  it("preserva preço explícito do catálogo e ignora datas inativas", () => {
    const parsed = parseBlackPassCatalogEvent({ id: 701, name: "Pagode no GOAT CLUB", address_comp: "GOAT CLUB", city: "Santos", price: "75,50", dates: [{ dstart: "2030-09-20T22:00:00.000Z", status: "0" }, { dstart: "2030-09-21T22:00:00.000Z", status: "1" }] });
    expect(parsed).toMatchObject({ eventDate: "2030-09-21T22:00:00.000Z", priceCents: 7550 });
    expect(BLACKPASS_FETCH_TIMEOUT_MS).toBe(20_000);
  });

  it("normaliza metadados públicos do Mr Ingressos", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Event",
      name: "Isso é Boteco",
      startDate: "2026-08-29T22:00:00-03:00",
      location: { name: "Boteco Almare", address: { addressLocality: "Guarujá", streetAddress: "Av. Atlântica, 200" } },
      offers: { price: "45.50" },
    })}</script>`;
    const parsed = parseMrIngressosEventMetadata(html, "https://mringressos.com.br/comprar/439/isso-e-boteco");
    expect(parsed).toMatchObject({ title: "Isso é Boteco", city: "Guarujá", priceCents: 4550 });
  });

  it("descobre cards reais do catálogo Mr Ingressos e deduplica destaque/agenda", () => {
    const html = `<a href="/comprar/442/se-beber-nao-case">SEX, 28 AGO · 19h00 Se beber Não Case Dolores Bar e Restaurante - Guarujá, SP</a><a href="https://mringressos.com.br/comprar/442/se-beber-nao-case">duplicado</a><a href="/comprar/439/isso-e-boteco">SAB, 29 AGO · 22h00 Isso é Boteco Boteco Almare - Guarujá, SP</a>`;
    expect(extractMrIngressosListingEvents(html)).toHaveLength(2);
    expect(extractMrIngressosListingEvents(html)[0]).toMatchObject({ url: "https://mringressos.com.br/comprar/442/se-beber-nao-case", title: "Se beber Não Case" });
  });

  it("descobre rotas Black Pass no HTML e em atributos incorporados", () => {
    const html = `<a href="/event/700">Jungle Room</a><div data-url="/event/692"></div>`;
    expect(extractPublicEventLinks(html, "https://blackpass.com.br/events")).toEqual(["https://blackpass.com.br/event/700", "https://blackpass.com.br/event/692"]);
  });

  it("normaliza o estado JSON público de um evento Sympla", () => {
    const state = { props: { pageProps: { hydrationData: { eventHydration: { event: {
      name: "Festa House no GOAT CLUB", logoUrl: "https://images.sympla.com.br/event.jpg",
      startDateMultiFormat: { ISO8601: "2030-09-22T22:00:00-03:00" },
      eventsAddress: { name: "GOAT CLUB", address: "Rua Example", addressNum: "100", city: "Santos", state: "SP", geolocation: { latitude: -23.93, longitude: -46.33 } },
      strippedDetail: "DJ e música house. Ingressos a partir de R$ 80,00",
    } } } } } };
    const html = `<meta property="og:title" content="Festa House no GOAT CLUB"><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`;
    expect(parseSymplaEventMetadata(html, "https://www.sympla.com.br/evento/festa-house/123")).toMatchObject({ title: "Festa House no GOAT CLUB", eventDate: "2030-09-22T22:00:00-03:00", locationName: "GOAT CLUB", city: "Santos", genre: "house_eletronica", priceCents: 8000, sourceUrl: "https://www.sympla.com.br/evento/festa-house/123" });
  });

  it("descobre links de eventos Sympla em páginas de busca", () => {
    expect(extractPublicEventLinks('<a href="/evento/festa-house/123">Festa</a>', "https://www.sympla.com.br/eventos/santos-sp")).toEqual(["https://www.sympla.com.br/evento/festa-house/123"]);
    expect(SYMPLA_FETCH_TIMEOUT_MS).toBe(20_000);
  });

  it("normaliza evento WeTicket do O Beco com data em português e lote", () => {
    const html = `<title>APÊ 22 — Especial Halloween</title><meta property="og:image" content="https://cdn.weticket.com.br/ape22.jpg"><main>APÊ 22 — Especial Halloween O BECO, SANTOS, SP Sexta-feira, 30 de outubro de 2026, às 22:00 horas. Ingressos 1º lote R$ 45,00</main>`;
    expect(parseWeTicketEventMetadata(html, "https://www.weticket.com.br/ape-22-especial-halloween")).toMatchObject({ title: "APÊ 22 — Especial Halloween", eventDate: "2026-10-30T22:00:00-03:00", locationName: "O BECO", city: "Santos", priceCents: 4500, sourceUrl: "https://www.weticket.com.br/ape-22-especial-halloween" });
    expect(containsTargetVenue("O BECO, Santos", ["o beco"])).toBe(true);
    expect(WETICKET_FETCH_TIMEOUT_MS).toBe(20_000);
  });

  it("mantém o timeout do Ingresse limitado para tolerar respostas lentas", () => {
    const previous = process.env.INGRESSE_FETCH_TIMEOUT_MS;
    try {
      delete process.env.INGRESSE_FETCH_TIMEOUT_MS;
      expect(getIngresseFetchTimeoutMs()).toBe(15_000);
      process.env.INGRESSE_FETCH_TIMEOUT_MS = "25000";
      expect(getIngresseFetchTimeoutMs()).toBe(20_000);
      process.env.INGRESSE_FETCH_TIMEOUT_MS = "1000";
      expect(getIngresseFetchTimeoutMs()).toBe(3_000);
    } finally {
      if (previous === undefined) delete process.env.INGRESSE_FETCH_TIMEOUT_MS;
      else process.env.INGRESSE_FETCH_TIMEOUT_MS = previous;
    }
  });

  it("aceita apenas venues da allowlist oficial", () => {
    expect(containsTargetVenue("GOAT CLUB, Santos", ["goat club"])).toBe(true);
    expect(containsTargetVenue("Dolores Bar e Restaurante - Guarujá", ["dolores bar e restaurante"])).toBe(true);
    expect(containsTargetVenue("Sede Vicente - Guarujá", ["goat club", "dolores bar e restaurante"])).toBe(false);
  });

  it("normaliza evento musical estruturado do Parque Valongo", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Event", name: "Festival de Música no Parque Valongo", startDate: "2030-10-12T18:00:00-03:00", location: { name: "Parque Valongo", address: { addressLocality: "Santos", streetAddress: "Rua Antônio Prado, s/nº" } } })}</script>`;
    expect(parseParqueValongoEventMetadata(html, "https://www.turismosantos.com.br/pt-br/eventos/parque-valongo-musica")).toMatchObject({ title: "Festival de Música no Parque Valongo", city: "Santos", locationName: "Parque Valongo", genre: "house_eletronica" });
    expect(PARQUE_VALONGO_FETCH_TIMEOUT_MS).toBe(20_000);
  });

  it("usa fallback HTML do Parque Valongo quando o JSON-LD está ausente", () => {
    const html = `<article class="evento"><h2>Festival de Música no Parque Valongo</h2><time datetime="2030-10-12T18:00:00-03:00"></time><p>Parque Valongo, Santos — festival com DJ e música eletrônica</p></article>`;
    expect(parseParqueValongoEventMetadata(html, "https://www.turismosantos.com.br/pt-br/eventos/parque-valongo-musica")).toMatchObject({
      title: "Festival de Música no Parque Valongo",
      eventDate: "2030-10-12T18:00:00-03:00",
      city: "Santos",
      locationName: "Parque Valongo",
      genre: "house_eletronica",
    });
  });

  it("reconhece a página pública do produtor Eventos Litoral sem fabricar evento", () => {
    const parsed = parseEventosLitoralOrganizerMetadata("<title>Eventos Litoral</title><main>Eventos Litoral próximos eventos Articket Santos</main>", "https://articket.com.br/o/58/eventos-litoral");
    expect(parsed?.text).toContain("Eventos Litoral");
    expect(parsed?.sourceUrl).toBe("https://articket.com.br/o/58/eventos-litoral");
    expect(publicSourceKey("https://www.turismosantos.com.br/pt-br/tags/parque-valongo")).toBe("public:parque-valongo");
    expect(publicSourceKey("https://articket.com.br/o/58/eventos-litoral")).toBe("public:eventos-litoral");
    expect(EVENTOS_LITORAL_FETCH_TIMEOUT_MS).toBe(20_000);
  });

  it("normaliza evento Articket associado ao produtor Eventos Litoral", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Event", name: "Feijuca no Arcos", startDate: "2030-11-28T20:00:00-03:00", location: { name: "Arcos do Valongo", address: { addressLocality: "Santos", streetAddress: "Rua Antônio Prado, s/nº" } }, offers: { price: "50.00" } })}</script><meta property="og:image" content="https://cdn.example/feijuca.jpg"><main>Feijuca no Arcos Santos samba pagode</main>`;
    expect(containsTargetVenue("Arcos do Valongo, Santos", ["arcos do valongo"])).toBe(true);
    expect(parseArticketEventMetadata(html, "https://articket.com.br/e/7163/feijuca-no-arcos-tiee")).toMatchObject({ title: "Feijuca no Arcos", eventDate: "2030-11-28T20:00:00-03:00", locationName: "Arcos do Valongo", city: "Santos", priceCents: 5000, category: "evento_musical", genre: "samba_pagode" });
    expect(publicSourceKey("https://articket.com.br/e/7163/feijuca-no-arcos-tiee")).toBe("public:articket");
  });
  it("captura dinamicamente a virada de lote da página Articket", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Event", name: "O Encontro — Edição Sunset", startDate: "2030-12-12T18:00:00-03:00", location: { name: "Parque Valongo", address: { addressLocality: "Santos", streetAddress: "Rua Antônio Prado" } }, offers: { name: "2º Lote", price: "75.00", description: "Ingresso inteiro" } })}</script><main>O Encontro — Edição Sunset 2º Lote R$ 75,00 Parque Valongo Santos</main>`;
    expect(parseArticketEventMetadata(html, "https://articket.com.br/e/7160/o-encontro")).toMatchObject({ title: "O Encontro — Edição Sunset", priceCents: 7500, priceNote: "2º Lote — Ingresso inteiro", locationName: "Parque Valongo", city: "Santos" });
  });

  it("extrai somente eventos musicais futuros elegíveis da agenda Blue Med", () => {
    const html = `<div class="card-evento"><img src="https://cdn.example/roberto.png"><p class="titulo-evento">SHOW ROBERTO CARLOS</p><p class="data-evento">31/10/2026</p><p class="botao-evento"><a href="https://eventim.com.br/roberto">saiba</a></p></div><div class="card-evento"><p class="titulo-evento">EVENTO FECHADO</p><p class="data-evento">01/11/2026</p></div><div class="card-evento"><p class="titulo-evento">SHOW PAGODIN COM BELO</p><p class="data-evento">23/11/2026</p></div>`;
    const parsed = parseBlueMedAgendaEvents(html, "https://santosconventioncenter.com.br/agenda-2026/");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ title: "SHOW PAGODIN COM BELO", city: "Santos", locationName: "Santos Convention Center", genre: "samba_pagode", sourceUrl: "https://santosconventioncenter.com.br/agenda-2026/" });
    expect(containsTargetVenue("Blue Med Convention Center, Santos", ["blue med convention center"])).toBe(true);
    expect(containsTargetVenue("Mendes Convention Center, Santos", ["mendes convention center"])).toBe(true);
    expect(publicSourceKey("https://santosconventioncenter.com.br/agenda-2026/")).toBe("public:blue-med");
    expect(BLUE_MED_FETCH_TIMEOUT_MS).toBe(20_000);
  });
});
