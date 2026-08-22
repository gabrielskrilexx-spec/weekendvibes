import { describe, expect, it } from "vitest";
import { areFuzzyDuplicateEvents, normalizeVenueCity } from "./ingestion";

describe("ingestion deduplication and venue normalization", () => {
  it("recognizes near-duplicate titles on the same day and city", () => {
    expect(areFuzzyDuplicateEvents(
      { title: "Froid ao Vivo no Santos", eventDate: new Date("2026-10-10T22:00:00-03:00"), city: "Santos" },
      { title: "Froid ao vivo Santos", eventDate: new Date("2026-10-10T23:00:00-03:00"), city: "Santos" },
    )).toBe(true);
  });

  it("does not merge different cities or distant dates", () => {
    expect(areFuzzyDuplicateEvents(
      { title: "Froid ao Vivo", eventDate: new Date("2026-10-10T22:00:00-03:00"), city: "Santos" },
      { title: "Froid ao Vivo", eventDate: new Date("2026-11-10T22:00:00-03:00"), city: "Santos" },
    )).toBe(false);
    expect(areFuzzyDuplicateEvents(
      { title: "Froid ao Vivo", eventDate: new Date("2026-10-10T22:00:00-03:00"), city: "Santos" },
      { title: "Froid ao Vivo", eventDate: new Date("2026-10-10T22:00:00-03:00"), city: "Guarujá" },
    )).toBe(false);
  });

  it("normalizes Vallum Garden to Santos", () => {
    expect(normalizeVenueCity("Vallum Garden", "", "Guarujá")).toBe("Santos");
    expect(normalizeVenueCity("Laroc Club", "Guarujá", "Guarujá")).toBe("Guarujá");
  });
});
