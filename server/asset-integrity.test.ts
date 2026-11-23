import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listIndexableVenueCatalogForTest, preserveExistingEventCover } from "./db";
import { isVenueCoverAsset, resolveVenueCoverFallback } from "../shared/event-media";

const publicRoot = resolve(process.cwd(), "client/public");
const venueAssetPath = (imageUrl: string) => resolve(publicRoot, imageUrl.replace(/^\/+/, ""));

describe("integridade dos assets de venues", () => {
  it("resolve 100% dos caminhos do catálogo e dos fallbacks para arquivos físicos", () => {
    const catalog = listIndexableVenueCatalogForTest();
    const declaredPaths = new Set<string>(["/images/venues/venue-placeholder.svg"]);

    for (const venue of catalog) {
      declaredPaths.add(venue.imageUrl);
      declaredPaths.add(resolveVenueCoverFallback({ locationName: venue.canonicalName }));
    }

    const missing = [...declaredPaths].filter(imageUrl => !existsSync(venueAssetPath(imageUrl)));
    expect(missing, `Assets ausentes em client/public: ${missing.join(", ")}`).toEqual([]);
  });

  it("não reutiliza a capa do Vallum para outra venue", () => {
    const catalog = listIndexableVenueCatalogForTest();
    const vallumCover = "/venues/vallum-garden.webp";

    for (const venue of catalog) {
      const fallback = resolveVenueCoverFallback({ locationName: venue.canonicalName });
      if (venue.canonicalName !== "Vallum Garden") expect(fallback).not.toBe(vallumCover);
    }

    expect(resolveVenueCoverFallback({ locationName: "Yellow House" })).toBe("/images/venues/yellow-house.jpg");
    expect(resolveVenueCoverFallback({ locationName: "Meu Lugar" })).toBe("/images/venues/meu-lugar.jpg");
    expect(resolveVenueCoverFallback({ locationName: "Vallum Garden" })).toBe(vallumCover);
  });

  it("identifica somente assets locais de venues como fallback", () => {
    expect(isVenueCoverAsset("/images/venues/yellow-house.jpg")).toBe(true);
    expect(isVenueCoverAsset("/venues/vallum-garden.webp")).toBe(true);
    expect(isVenueCoverAsset("https://cdn.articket.com.br/flyer.webp")).toBe(false);
  });
});

describe("proteção de flyer existente durante a atualização", () => {
  it("preserva flyer HTTPS quando a nova coleta está vazia ou só tem fallback local", () => {
    const flyer = "https://cdn.articket.com.br/flyers/mc-kelvinho.webp";
    expect(preserveExistingEventCover(flyer, "")).toBe(flyer);
    expect(preserveExistingEventCover(flyer, "/images/venues/yellow-house.jpg")).toBe(flyer);
    expect(preserveExistingEventCover(flyer, "/venues/vallum-garden.webp")).toBe(flyer);
  });

  it("aceita uma nova capa oficial HTTPS e não inventa flyer para registro sem capa", () => {
    const nextFlyer = "https://kraken.ingresse.com/event/posters/123/large/flyer.jpg";
    expect(preserveExistingEventCover("/images/venues/yellow-house.jpg", nextFlyer)).toBe(nextFlyer);
    expect(preserveExistingEventCover("", "/images/venues/yellow-house.jpg")).toBe("/images/venues/yellow-house.jpg");
    expect(preserveExistingEventCover("", "")).toBe("");
  });
});
