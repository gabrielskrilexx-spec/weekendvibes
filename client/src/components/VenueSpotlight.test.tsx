import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import VenueSpotlight from "./VenueSpotlight";

const event = { id: 1, title: "Jamboo Session Santos", eventDate: "2030-11-23T20:00:00-03:00", locationName: "Casa 412" } as never;
const curatedVenues = [
  ["vallum-garden", "Vallum Garden"], ["blue-med-convention-center", "Blue Med Convention Center"], ["parque-valongo", "Parque Valongo"], ["casa-412", "Casa 412"], ["laroc-club", "Laroc Club"], ["o-beco", "O Beco"], ["dolores-restaurante-e-bar", "Dolores Restaurante e Bar"], ["projac-bar", "Projac Bar"], ["meu-lugar", "Meu Lugar"], ["moby-dick", "Moby Dick"],
] as const;

function dynamicCatalog() {
  return curatedVenues.map(([slug, canonicalName]) => ({ slug, canonicalName, city: slug === "laroc-club" || slug === "dolores-restaurante-e-bar" || slug === "projac-bar" ? "Guarujá" : "Santos", aliases: [canonicalName], query: canonicalName, imageUrl: "https://example.com/venue-cover.jpg", description: "Local oficial da Baixada." }));
}

describe("VenueSpotlight", () => {
  it("exibe somente os dez palcos oficiais com imagens e sem locais removidos", () => {
    const markup = renderToStaticMarkup(<VenueSpotlight selectedVenue="" onSelect={vi.fn()} events={[]} dynamicVenues={dynamicCatalog()} />);
    for (const [, name] of curatedVenues) expect(markup).toContain(name);
    expect(markup.match(/https:\/\/example\.com\/venue-cover\.jpg/g)?.length).toBe(10);
    for (const removed of ["Casa Grande Hotel Resort", "Flamingo", "Goat Dining Club", "Mendes Convention Center", "Moby House", "Osuco", "Arcos do Valongo", "Arena Club", "Goat Club", "Curvão Surf House"]) expect(markup).not.toContain(removed);
    expect(markup).not.toContain("casa-412 · Casa 412");
  });

  it("mantém a vitrine visual quando o catálogo da API ainda não carregou", () => {
    const markup = renderToStaticMarkup(<VenueSpotlight selectedVenue="casa-412" onSelect={vi.fn()} events={[event]} />);
    expect(markup).toContain("Casa 412");
    expect(markup).toContain("/venues/vallum-garden.webp");
    expect(markup).toContain("Ponta da Praia · Santos - SP");
    expect(markup).toContain("Jamboo Session Santos");
  });
});
