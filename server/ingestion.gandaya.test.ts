import { describe, expect, it, vi } from "vitest";
import { extractGandayaEventLinks, fetchGandayaRegionalEventLinks, filterGandayaRegionalCandidates, parseGandayaEventMetadata, publicPageToOneOffEvent, publicSourceKey } from "./ingestion";
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

  it("consulta POST /events/list, mantém apenas Santos/Guarujá e retorna diagnóstico", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({ take: 100 });
      return new Response(JSON.stringify([
        { alias: "sorry-project-46c6", title: "Sorry Project", city: "Santos" },
        { alias: "baile-guaruja", title: "Baile Guarujá", location: { name: "Praiô", city: "Guarujá" } },
        { alias: "evento-rio", title: "Evento Rio", city: "Rio de Janeiro" },
      ]), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(fetchGandayaRegionalEventLinks()).resolves.toMatchObject({
        urls: ["https://gandaya.dance/events/sorry-project-46c6", "https://gandaya.dance/events/baile-guaruja"],
        listingCount: 3,
        regionalFiltered: 1,
        status: "succeeded",
      });
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });

  it("normalizes a Gandaya page for one-off import using explicit overrides", () => {
    const page = { url: "https://gandaya.dance/events/sorry-project-46c6", html: "", text: "Sorry Project", imageUrl: "https://gandaya-prod.s3.us-east-2.amazonaws.com/flyer", structured: { title: "Sorry Project", eventDate: "2026-12-05T01:00:00.000Z", locationName: "Centro Histórico de Santos", address: "Centro, Santos - SP", description: "", category: "balada" } };
    expect(publicPageToOneOffEvent(page, { cityOverride: "Santos", genreOverride: "funk" })).toMatchObject({ title: "Sorry Project", city: "Santos", genre: "funk", sourceUrl: page.url, imageUrl: page.imageUrl });
  });

  it("accepts the Gandaya API event without description/tags when overrides supply city and genre", () => {
    const parsed = parseGandayaEventMetadata({
      alias: "sorry-project-46c6",
      title: "Sorry Project",
      date: { startDate: "2026-12-05T01:00:00.000Z", endDate: "2026-12-05T08:00:00.000Z" },
      description: "",
      tags: [],
      lineup: [],
      location: { name: "Centro Histórico de Santos", address: "Santos - SP" },
      imageKey: "flyers/sorry-project.jpg",
    }, "https://gandaya.dance/events/sorry-project-46c6", { allowMissingClassification: true });
    expect(parsed).toMatchObject({ title: "Sorry Project", eventDate: "2026-12-05T01:00:00.000Z", imageUrl: "https://gandaya-prod.s3.us-east-2.amazonaws.com/flyers/sorry-project.jpg" });
    expect(publicPageToOneOffEvent({ url: "https://www.gandaya.dance/events/sorry-project-46c6", html: "", text: "", imageUrl: parsed?.imageUrl ?? "", structured: parsed }, { cityOverride: "Santos", genreOverride: "funk" })).toMatchObject({ city: "Santos", genre: "funk", sourceUrl: "https://www.gandaya.dance/events/sorry-project-46c6" });
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
