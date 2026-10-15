import { describe, expect, it } from "vitest";
import { extractPublicEventLinks, getConfiguredSourceUrls, parseZigEventMetadata, ZIG_FETCH_TIMEOUT_MS } from "./ingestion";

describe("Zig Tickets adapter", () => {
  it("discovers internal event routes from the catalog HTML", () => {
    const html = `
      <a href="/eventos/froid-santos"><span>Froid em Santos</span><small>Santos</small></a>
      <a href="https://zig.tickets/eventos/laroc-guaruja"><span>Laroc Guarujá</span><small>Guarujá</small></a>
      <a href="/eventos/japa-faz-a-festa-cabelinho">Japa Vila Velha</a>
      <a href="/categorias/funk">Funk</a>
      <a href="https://example.com/eventos/fora-da-fonte">External</a>
    `;

    expect(extractPublicEventLinks(html, "https://zig.tickets/pt-BR")).toEqual([
      "https://zig.tickets/eventos/froid-santos",
      "https://zig.tickets/eventos/laroc-guaruja",
    ]);
  });

  it("parses Zig JSON-LD metadata with precise schedule and price", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Event",
      name: "Froid em Santos",
      startDate: "2026-10-10T22:00:00-03:00",
      location: { name: "Arena Club", address: { streetAddress: "Av. Ana Costa, 100", addressLocality: "Santos" } },
      offers: { price: "89.90" },
    })}</script><meta property="og:image" content="https://cdn.example/froid.jpg">`;
    expect(parseZigEventMetadata(html, "https://zig.tickets/eventos/froid-santos")).toMatchObject({
      title: "Froid em Santos",
      eventDate: "2026-10-10T22:00:00-03:00",
      locationName: "Arena Club",
      city: "Santos",
      priceCents: 8990,
    });
  });

  it("normaliza Osuco Black And White com data, Santos e menor preço público", () => {
    const html = `<meta property="og:image" content="https://cdn.zig.tickets/osuco.jpg"><script type="application/ld+json">${JSON.stringify({
      "@type": "Event",
      name: "Osuco Black And White",
      startDate: "2026-10-16T22:00:00-03:00",
      location: { name: "Osuco", address: { streetAddress: "Santos, SP", addressLocality: "Santos" } },
      offers: [{ price: "80.00" }],
    })}</script>`;
    expect(parseZigEventMetadata(html, "https://zig.tickets/eventos/osuco-black-and-white")).toMatchObject({
      title: "Osuco Black And White",
      eventDate: "2026-10-16T22:00:00-03:00",
      locationName: "Osuco",
      city: "Santos",
      priceCents: 8000,
      imageUrl: "https://cdn.zig.tickets/osuco.jpg",
      sourceUrl: "https://zig.tickets/eventos/osuco-black-and-white",
    });
  });

  it("mantém a Zig no catálogo padrão e usa timeout de 20 segundos", () => {
    expect(getConfiguredSourceUrls()).toContain("https://zig.tickets/pt-BR");
    expect(ZIG_FETCH_TIMEOUT_MS).toBe(20_000);
  });
});
