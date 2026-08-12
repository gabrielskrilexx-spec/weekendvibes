import { describe, expect, it } from "vitest";
import { filterEventsForPublicFeed } from "./db";

describe("filterEventsForPublicFeed", () => {
  it("remove eventos fora das cidades, categorias, gêneros e preço selecionados", () => {
    const result = filterEventsForPublicFeed([
      { city: "Santos", category: "show", genre: "funk", locationName: "Valluns Garden", priceCents: 2000, eventDate: new Date() },
      { city: "Guarujá", category: "balada", genre: "house_eletronica", locationName: "Laroc Club Guarujá", priceCents: 8000, eventDate: new Date() },
      { city: "Praia Grande", category: "show", genre: "funk", locationName: "Fora do escopo", priceCents: 1000, eventDate: new Date() },
      { city: "Santos", category: "cultura", genre: "funk", locationName: "Centro Cultural", priceCents: 1000, eventDate: new Date() },
    ], { city: "Santos", category: "show", genre: "funk", venue: "Valluns", maxPriceCents: 5000 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ city: "Santos", category: "show", genre: "funk" });
  });
});
