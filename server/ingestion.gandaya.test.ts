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

  it("parses the real Gandaya detail contract with nested date and location address", () => {
    const parsed = parseGandayaEventMetadata({
      id: 2088,
      alias: "sorry-project-46c6",
      title: "Sorry Project",
      description: "Uma noite de funk e rap em Santos.",
      tags: ["funk"],
      date: { startDate: "2026-12-05T01:00:00.000Z", endDate: "2026-12-05T08:00:00.000Z" },
      imageKey: "b8fce99f-ba71-475e-875a-9eeb977755f3",
      location: { name: "Centro Histórico de Santos", address: "Centro, Santos - SP, 11010-000, Brasil" },
    });
    expect(parsed).toMatchObject({
      title: "Sorry Project",
      eventDate: "2026-12-05T01:00:00.000Z",
      city: "Santos",
      locationName: "Centro Histórico de Santos",
      genre: "funk",
      imageUrl: "https://gandaya-prod.s3.us-east-2.amazonaws.com/b8fce99f-ba71-475e-875a-9eeb977755f3",
    });
  });

  it("keeps only Santos and Guarujá before detail fetches", () => {
    const result = filterGandayaRegionalCandidates([
      { alias: "santos", location: "Espaço 14", text: "Santos" },
      { alias: "guaruja", location: "Praiô", text: "Guarujá" },
      { alias: "rio", location: "Centro", text: "Rio de Janeiro" },
      { alias: "praia-grande", location: "Clube", text: "Praia Grande" },
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

  it("discovers aliases from the real POST /events/list array payload", () => {
    expect(extractGandayaEventLinks([
      { id: 2088, alias: "sorry-project-46c6", title: "Sorry Project" },
      { id: 2089, alias: "outro-evento", title: "Outro evento" },
    ])).toEqual([
      "https://gandaya.dance/events/sorry-project-46c6",
      "https://gandaya.dance/events/outro-evento",
    ]);
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
