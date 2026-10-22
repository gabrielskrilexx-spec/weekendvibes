import { describe, expect, it } from "vitest";
import { containsTargetVenue, extractPublicEventLinks, getConfiguredSourceUrls, parseZigEventMetadata, sanitizePublicSourceUrl, ZIG_FETCH_TIMEOUT_MS } from "./ingestion";

describe("Zig Tickets adapter", () => {
  it("extrai Curvão e Praia Verde a partir do Markdown entregue sob CAPTCHA", () => {
    const curvao = `# RÉVEILLON CURVÃO 2027 - OPEN BAR\n- **Quando:** quinta-feira, 31 de dezembro de 2026 às 20:00\n- **Onde:** Curvão Surf House, Guarujá, SP\n- **Endereço:** Avenida Miguel Estefno, 2435 - Enseada, Guarujá, SP`;
    expect(parseZigEventMetadata(curvao, "https://zig.tickets/eventos/reveillon-curvao-2027")).toMatchObject({ title: "RÉVEILLON CURVÃO 2027 - OPEN BAR", eventDate: "2026-12-31T20:00:00-03:00", locationName: "Curvão Surf House", city: "Guarujá", category: "balada", genre: "house_eletronica" });
    const praia = `# PRAIA VERDE SUMMER - INIMIGOS DA HP\n- **Quando:** sexta-feira, 20 de novembro de 2026 às 17:00\n- **Onde:** Guarujá, SP\n- **Endereço:** Avenida Marechal Deodoro da Fonseca, 773 - Pitangueiras, Guarujá, SP\nPRAIA VERDE BEACH CLUB Música Sunset e experiências`;
    expect(parseZigEventMetadata(praia, "https://zig.tickets/eventos/praia-verde-summer-inimigos-da-hp")).toMatchObject({ title: "PRAIA VERDE SUMMER - INIMIGOS DA HP", eventDate: "2026-11-20T17:00:00-03:00", locationName: "Praia Verde Beach Club", city: "Guarujá", category: "balada", genre: "house_eletronica" });
  });

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
      category: "",
      genre: "",
      priceCents: 8990,
    });
  });

  it("classifica o INSIDE 001 do Curvão como balada eletrônica", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Event",
      name: "Inside 001",
      startDate: "2026-10-23T20:00:00-03:00",
      location: { name: "Curvão Surf House", address: { streetAddress: "Avenida Miguel Estefno", addressLocality: "Guarujá" } },
      description: "O verão começa mais cedo. Uma noite de música, praia e muita energia com DJs.",
      offers: { price: 15 },
    })}</script>`;
    expect(parseZigEventMetadata(html, "https://zig.tickets/eventos/inside-001")).toMatchObject({
      title: "Inside 001",
      locationName: "Curvão Surf House",
      city: "Guarujá",
      category: "balada",
      genre: "house_eletronica",
    });
    expect(containsTargetVenue("Curvão Surf House, Guarujá", ["curvao surf house"])).toBe(true);
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

  it("infere Osuco pelo conteúdo quando o JSON-LD não informa venue", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ name: "Osuco Gold Edition", startDate: "2030-10-16T22:00:00-03:00", location: { address: { addressLocality: "Santos" } }, offers: { price: "80.00" } })}</script>`;
    expect(parseZigEventMetadata(html, "https://zig.tickets/eventos/osuco-gold-edition")).toMatchObject({ locationName: "Osuco", city: "Santos" });
  });

  it("remove rastreadores e aceita aliases oficiais da allowlist", () => {
    expect(sanitizePublicSourceUrl("https://zig.tickets/eventos/osuco-black-and-white?utm_source=x&fbclid=y#section")).toBe("https://zig.tickets/eventos/osuco-black-and-white");
    expect(containsTargetVenue("O Beco Bar, Santos", ["o beco bar"])).toBe(true);
    expect(containsTargetVenue("O Beco Santos", ["o beco santos"])).toBe(true);
    expect(containsTargetVenue("Praia Verde Beach Club, Guarujá", ["praia verde beach club"])).toBe(true);
    expect(containsTargetVenue("Praia Verde, Guarujá", ["praia verde"])).toBe(true);
    expect(containsTargetVenue("Casa Grande Hotel Resort, Guarujá", ["casa grande hotel resort"])).toBe(true);
    expect(containsTargetVenue("Casa Grande Hotel, Guarujá", ["casa grande hotel"])).toBe(true);
  });
});
