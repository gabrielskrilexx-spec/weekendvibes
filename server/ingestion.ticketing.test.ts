import { describe, expect, it } from "vitest";
import { containsTargetVenue, extractMrIngressosListingEvents, extractPublicEventLinks, getIngresseFetchTimeoutMs, parseBlackPassCatalogEvent, parseBlackPassEventMetadata, parseMrIngressosEventMetadata } from "./ingestion";

describe("adapters de ticketeiras oficiais", () => {
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

  it("mantém o timeout do Ingresse curto e limitado para falhar rápido", () => {
    const previous = process.env.INGRESSE_FETCH_TIMEOUT_MS;
    try {
      delete process.env.INGRESSE_FETCH_TIMEOUT_MS;
      expect(getIngresseFetchTimeoutMs()).toBe(6_000);
      process.env.INGRESSE_FETCH_TIMEOUT_MS = "25000";
      expect(getIngresseFetchTimeoutMs()).toBe(10_000);
      process.env.INGRESSE_FETCH_TIMEOUT_MS = "1000";
      expect(getIngresseFetchTimeoutMs()).toBe(3_000);
    } finally {
      if (previous === undefined) delete process.env.INGRESSE_FETCH_TIMEOUT_MS;
      else process.env.INGRESSE_FETCH_TIMEOUT_MS = previous;
    }
  });

  it("aceita apenas venues da allowlist oficial", () => {
    expect(containsTargetVenue("GOAT CLUB, Santos")).toBe(true);
    expect(containsTargetVenue("Dolores Bar e Restaurante - Guarujá")).toBe(true);
    expect(containsTargetVenue("Sede Vicente - Guarujá")).toBe(false);
  });
});
