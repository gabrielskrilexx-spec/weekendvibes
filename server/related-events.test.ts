import { describe, expect, it } from "vitest";
import { buildCanonicalEventUrl, buildEventShareUrl, selectRelatedEvents } from "../shared/related-events";

const current = { id: 1, eventDate: "2026-12-04T22:00:00-03:00", locationName: "Arena Club", city: "Santos" };

describe("related events and sharing", () => {
  it("prioriza o mesmo palco e depois a mesma cidade/fim de semana", () => {
    const result = selectRelatedEvents(current, [
      { id: 4, eventDate: "2026-12-05T22:00:00-03:00", locationName: "Outro Palco", city: "Santos" },
      { id: 3, eventDate: "2026-12-06T22:00:00-03:00", locationName: "Arena Club", city: "Guarujá" },
      { id: 2, eventDate: "2026-12-05T22:00:00-03:00", locationName: "Arena Club", city: "Santos" },
    ]);
    expect(result.map(event => event.id)).toEqual([2, 3, 4]);
  });

  it("gera URL de compartilhamento com UTM e canonical sem query string", () => {
    expect(buildEventShareUrl(42, "https://weekendvibes.example")).toBe("https://weekendvibes.example/evento/42?utm_source=share&utm_medium=social&utm_campaign=event_share");
    expect(buildCanonicalEventUrl(42, "https://weekendvibes.example")).toBe("https://weekendvibes.example/evento/42");
  });
});
