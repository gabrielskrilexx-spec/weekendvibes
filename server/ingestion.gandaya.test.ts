import { describe, expect, it } from "vitest";
import { extractGandayaEventLinks, filterGandayaRegionalCandidates, parseGandayaEventMetadata, publicSourceKey } from "./ingestion";
import { DEFAULT_INGESTION_SOURCES, listIndexableVenueCatalogForTest } from "./db";

describe("Gandaya public adapter", () => {
  it("parses a structured event with clean description, São Paulo date and durable S3 image", () => {
    const parsed = parseGandayaEventMetadata({
      alias: "plants-no-espaco-14",
      title: "Plants — Santos",
      description: "**Uma noite especial de música e DJ**\n\nIngressos e line-up no local.",
      date: "2026-12-12T02:00:00.000Z",
      lowestTicketPrice: 45,
      imageKey: "flyer-123.png",
      location: { name: "Espaço 14", address: "Rua do Comércio, 14 - Centro, Santos - SP", latitude: -23.93, longitude: -46.33 },
    });
    expect(parsed).toMatchObject({ title: "Plants — Santos", city: "Santos", locationName: "Espaço 14", priceCents: 4500, sourceUrl: "https://gandaya.dance/events/plants-no-espaco-14", imageUrl: "https://gandaya-prod.s3.us-east-2.amazonaws.com/flyer-123.png" });
    expect(parsed?.summary).not.toContain("**");
  });

  it("keeps only the five Baixada Santista cities before detail fetches", () => {
    const result = filterGandayaRegionalCandidates([
      { alias: "santos", location: "Espaço 14", text: "Santos" },
      { alias: "guaruja", location: "Praiô", text: "Guarujá" },
      { alias: "rio", location: "Centro", text: "Rio de Janeiro" },
      { alias: "itajai", location: "Clube", text: "Itajaí" },
    ]);
    expect(result.regional).toHaveLength(2);
    expect(result.filtered).toHaveLength(2);
  });

  it("discovers aliases from the public front-page payload", () => {
    expect(extractGandayaEventLinks({ main: { alias: "main-event" }, sections: [{ events: [{ alias: "santos-event" }] }], otherEvents: [{ alias: "other-event" }] })).toEqual([
      "https://gandaya.dance/events/main-event",
      "https://gandaya.dance/events/santos-event",
      "https://gandaya.dance/events/other-event",
    ]);
    expect(publicSourceKey("https://gandaya.dance/")).toBe("public:gandaya");
  });
});

describe("Plants monitored brand", () => {
  it("is an Instagram source and is not exposed as a venue route", () => {
    expect(DEFAULT_INGESTION_SOURCES).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey: "instagram:plantssantos", name: "Plants", handle: "plantssantos", url: "https://www.instagram.com/plantssantos/" }),
    ]));
    expect(listIndexableVenueCatalogForTest().some(venue => /plants/i.test(`${venue.slug} ${venue.canonicalName}`))).toBe(false);
  });
});
