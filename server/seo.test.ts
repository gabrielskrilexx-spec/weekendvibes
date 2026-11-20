import { describe, expect, it } from "vitest";
import { buildBreadcrumbJsonLd, buildEventJsonLd, buildSitemapXml, formatSaoPauloIso } from "./seo";

const baseEvent = {
  id: 7,
  slug: "festa-no-curvao",
  title: "# Festa **no Curvão**",
  description: "**Uma noite incrível** com música.",
  eventDate: new Date("2026-12-05T01:00:00.000Z"),
  endDate: null,
  locationName: "Curvão Surf House",
  address: "Av. Atlântica, 100",
  city: "Guarujá",
  sourceUrl: "https://www.instagram.com/p/abc123/",
  sourceType: "instagram_feed",
  imageUrl: null,
  updatedAt: new Date("2026-11-20T12:00:00.000Z"),
};

describe("SEO estruturado", () => {
  it("gera Event com data -03:00, endereço, fallback de venue e sem offer para Instagram", () => {
    const json = buildEventJsonLd(baseEvent, "https://weekendvibes-dh6w.vercel.app");
    expect(json.name).toBe("Festa no Curvão");
    expect(json.description).toBe("Uma noite incrível com música.");
    expect(json.startDate).toBe("2026-12-04T22:00:00-03:00");
    expect(json.location.address.addressLocality).toBe("Guarujá");
    expect(json.image[0]).toContain("/images/venues/curvao.jpg");
    expect(json.offers).toBeUndefined();
  });
  it("inclui Offer apenas quando há URL externa de ingresso", () => {
    const json = buildEventJsonLd({ ...baseEvent, sourceUrl: "https://blackpass.com.br/eventos/festa" }, "https://weekendvibes-dh6w.vercel.app");
    expect(json.offers).toMatchObject({ url: "https://blackpass.com.br/eventos/festa", availability: "https://schema.org/InStock" });
  });
  it("gera BreadcrumbList com agenda, cidade e evento", () => {
    const json = buildBreadcrumbJsonLd(baseEvent, "https://weekendvibes-dh6w.vercel.app", "https://weekendvibes-dh6w.vercel.app/evento/7");
    expect(json.itemListElement.map(item => item.name)).toEqual(["WeekendVibes", "Agenda", "Guarujá", "Festa no Curvão"]);
    expect(json.itemListElement[3].item).toBe("https://weekendvibes-dh6w.vercel.app/evento/7");
  });
  it("formata o instante no fuso de São Paulo", () => {
    expect(formatSaoPauloIso("2026-12-05T01:00:00.000Z")).toBe("2026-12-04T22:00:00-03:00");
  });
  it("mantém apenas eventos futuros publicados recebidos pelo builder", () => {
    const now = new Date("2026-11-20T12:00:00.000Z");
    const xml = buildSitemapXml([
      { id: 7, slug: "futura", eventDate: new Date("2026-12-01T00:00:00.000Z"), updatedAt: new Date("2026-11-19T00:00:00.000Z") },
      { id: 8, slug: "encerrada", eventDate: new Date("2026-11-19T00:00:00.000Z"), updatedAt: new Date("2026-11-19T00:00:00.000Z") },
    ], "https://weekendvibes-dh6w.vercel.app", now);
    expect(xml).toContain("/evento/7");
    expect(xml).not.toContain("/evento/8");
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
  });
});
