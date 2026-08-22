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

  it("ignora hora e minuto ao comparar eventos do mesmo dia civil", () => {
    const meduzaAt13 = { eventDate: new Date("2026-09-05T13:00:00-03:00"), locationName: "Laroc Club Guarujá", city: "Guarujá" as const, title: "Laroc Guarujá apresenta: Meduza" };
    const meduzaAt16 = { ...meduzaAt13, eventDate: new Date("2026-09-05T16:00:00-03:00"), title: "Laroc Guarujá apresenta Meduza" };
    const reveillonAt19 = { eventDate: new Date("2026-12-31T19:00:00-03:00"), locationName: "Guarujá Golf Club", city: "Guarujá" as const, title: "Réveillon Guarujá 2027" };
    const reveillonAt22 = { ...reveillonAt19, eventDate: new Date("2026-12-31T22:00:00-03:00") };

    expect(isFuzzyDuplicateEventForTest(meduzaAt13, meduzaAt16)).toBe(true);
    expect(isFuzzyDuplicateEventForTest(reveillonAt19, reveillonAt22)).toBe(true);
  });

  it("não colide eventos de cidade, venue ou data diferentes", () => {
    const event = { ...base, title: "Mega Universitária Halloween" };
    expect(isFuzzyDuplicateEventForTest(event, { ...event, city: "Guarujá" })).toBe(false);
    expect(isFuzzyDuplicateEventForTest(event, { ...event, locationName: "Laroc Club Guarujá" })).toBe(false);
    expect(isFuzzyDuplicateEventForTest(event, { ...event, eventDate: new Date("2026-10-25T22:00:00-03:00") })).toBe(false);
  });
});
