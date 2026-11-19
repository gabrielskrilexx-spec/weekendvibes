import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import VenueSpotlight from "./VenueSpotlight";

const event = { id: 1, title: "Jamboo Session Santos", eventDate: "2030-11-23T20:00:00-03:00", locationName: "Casa 412" } as never;
const curatedVenues = [
  ["guaruja-golf-club", "Guarujá Golf Club"], ["goat", "GOAT"], ["curvao-surf-house", "Curvão Surf House"], ["boteco-almare", "Boteco Al Mare"], ["lucky-scope", "Lucky Scope · Nosso After"], ["praio", "Praiô"], ["praia-verde-beach-club", "Praia Verde Beach Club"], ["flamingos", "Flamingos"], ["vallum-garden", "Vallum Garden"], ["blue-med-convention-center", "Blue Med Convention Center"], ["parque-valongo", "Parque Valongo"], ["casa-412", "Casa 412"], ["laroc-club", "Laroc Club"], ["o-beco", "O Beco"], ["dolores", "Dolores Bar & Restaurante"], ["projac-bar", "Projac Bar"], ["meu-lugar", "Meu Lugar"], ["moby-dick", "Moby Dick"], ["arena-club", "Arena Club"], ["yellow-house", "Yellow House"],
] as const;

function dynamicCatalog() {
  return curatedVenues.map(([slug, canonicalName]) => ({ slug, canonicalName, city: slug === "laroc-club" || slug === "dolores" || slug === "projac-bar" || slug === "lucky-scope" || slug === "praio" || slug === "praia-verde-beach-club" ? "Guarujá" : "Santos", aliases: [canonicalName], query: canonicalName, imageUrl: "https://example.com/venue-cover.jpg", description: "Local oficial da Baixada." }));
}

describe("VenueSpotlight", () => {
  it("exibe somente os dez palcos oficiais com imagens e sem locais removidos", () => {
    const markup = renderToStaticMarkup(<VenueSpotlight selectedVenue="" onSelect={vi.fn()} events={[]} dynamicVenues={dynamicCatalog()} />);
    for (const [, name] of curatedVenues) expect(markup).toContain(name.replaceAll("&", "&amp;"));
    expect(markup.match(/https:\/\/example\.com\/venue-cover\.jpg/g)?.length).toBe(20);
    for (const removed of ["Casa Grande Hotel Resort", "Goat Dining Club", "Mendes Convention Center", "Moby House", "Osuco", "Arcos do Valongo", "Goat Club"]) expect(markup).not.toContain(removed);
    expect(markup).not.toContain("casa-412 · Casa 412");
  });

  it("mantém a vitrine visual quando o catálogo da API ainda não carregou", () => {
    const markup = renderToStaticMarkup(<VenueSpotlight selectedVenue="casa-412" onSelect={vi.fn()} events={[event]} />);
    expect(markup).toContain("Casa 412");
    expect(markup).toContain("/venues/vallum-garden.webp");
    expect(markup).toContain("/images/venues/dolores.jpg");
    expect(markup).toContain("Ponta da Praia · Santos - SP");
    expect(markup).toContain("Jamboo Session Santos");
    expect(markup).toContain("Rua do Comércio, nº 111 – Centro, Santos/SP (CEP 11010-122)");
  });

  it("formata data e horário no fuso America/Sao_Paulo", () => {
    const utcBoundaryEvent = { id: 2, title: "Evento em horário local", eventDate: "2026-12-13T02:00:00.000Z", locationName: "Casa 412" } as never;
    const markup = renderToStaticMarkup(<VenueSpotlight selectedVenue="casa-412" onSelect={vi.fn()} events={[utcBoundaryEvent]} />);
    expect(markup).toContain("12 de dez.");
    expect(markup).toContain("23:00");
  });
});
