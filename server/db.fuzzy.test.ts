import { describe, expect, it } from "vitest";
import { fuzzyTitleSimilarity, isFuzzyDuplicateEventForTest } from "./db";

const base = {
  eventDate: new Date("2026-10-24T22:00:00-03:00"),
  locationName: "Vallum Garden",
  city: "Santos" as const,
};

describe("deduplicação fuzzy de eventos", () => {
  it("classifica como duplicata títulos semelhantes de fontes diferentes no mesmo local e data", () => {
    const fromArticket = { ...base, title: "Mega Universitária Halloween", priceCents: 0, imageUrl: "", sourceUrl: "https://articket.com.br/a" };
    const fromBlacktag = { ...base, title: "Mega Universitária Halloween Vallum Garden", priceCents: 9900, imageUrl: "https://cdn.example/event.jpg", sourceUrl: "https://blacktag.com.br/b" };

    expect(fuzzyTitleSimilarity(fromArticket.title, fromBlacktag.title)).toBeGreaterThanOrEqual(0.6);
    expect(isFuzzyDuplicateEventForTest(fromArticket, fromBlacktag)).toBe(true);
    expect(fromBlacktag.priceCents).toBeGreaterThan(fromArticket.priceCents);
    expect(fromBlacktag.imageUrl).toBeTruthy();
  });

  it("não colide eventos de cidade, venue ou data diferentes", () => {
    const event = { ...base, title: "Mega Universitária Halloween" };
    expect(isFuzzyDuplicateEventForTest(event, { ...event, city: "Guarujá" })).toBe(false);
    expect(isFuzzyDuplicateEventForTest(event, { ...event, locationName: "Laroc Club Guarujá" })).toBe(false);
    expect(isFuzzyDuplicateEventForTest(event, { ...event, eventDate: new Date("2026-10-25T22:00:00-03:00") })).toBe(false);
  });
});
