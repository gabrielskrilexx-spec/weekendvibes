import { describe, expect, it } from "vitest";
import { distanceInKm, estimateMinutes, formatDistance, formatDuration, TRAVEL_MODES } from "./mapTravel";

describe("mapTravel", () => {
  it("calcula uma distância aproximada entre dois pontos", () => {
    const distance = distanceInKm({ latitude: -23.96, longitude: -46.33 }, { latitude: -23.99, longitude: -46.25 });
    expect(distance).toBeGreaterThan(8);
    expect(distance).toBeLessThan(10);
  });

  it("estima tempos diferentes para cada meio de transporte", () => {
    const walking = estimateMinutes(5, "walking");
    const driving = estimateMinutes(5, "driving");
    expect(walking).toBeGreaterThan(driving);
    expect(TRAVEL_MODES.transit.mapsMode).toBe("transit");
    expect(TRAVEL_MODES.bicycling.mapsMode).toBe("bicycling");
  });

  it("formata distância e duração para a interface", () => {
    expect(formatDistance(0.6)).toBe("600 m");
    expect(formatDistance(4.25)).toBe("4,3 km");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(75)).toBe("1h 15min");
  });
});
