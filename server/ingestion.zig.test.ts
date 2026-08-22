import { describe, expect, it } from "vitest";
import { extractPublicEventLinks, parseZigEventMetadata } from "./ingestion";

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
});
