import { describe, expect, it } from "vitest";
import { containsTargetVenue, parseBlackPassCatalogEvent, parseBlackPassEventMetadata, parseMrIngressosEventMetadata } from "./ingestion";

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

  it("aceita apenas venues da allowlist oficial", () => {
    expect(containsTargetVenue("GOAT CLUB, Santos")).toBe(true);
    expect(containsTargetVenue("Dolores Bar e Restaurante - Guarujá")).toBe(true);
    expect(containsTargetVenue("Sede Vicente - Guarujá")).toBe(false);
  });
});
