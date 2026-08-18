import { describe, expect, it } from "vitest";
import { isRegionalCoordinate, reconcileIngestionResult } from "./reconciliation";

describe("ingestion reconciliation", () => {
  it("accepts consistent counts and regional coordinates", () => {
    expect(isRegionalCoordinate(-23.96, -46.33)).toBe(true);
    expect(reconcileIngestionResult({ read: 10, filtered: 4, persisted: 6, retries: 1 })).toMatchObject({
      counts: { read: 10, filtered: 4, persisted: 6 },
      consistent: true,
      retries: 1,
    });
  });

  it("flags impossible counts and geolocation quality issues", () => {
    const result = reconcileIngestionResult({ read: 2, filtered: 3, persisted: 4, duplicates: 5, missingCoordinates: 2, outOfBoundsCoordinates: 1 });
    expect(result.consistent).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining(["filtered_exceeds_read", "persisted_exceeds_read", "duplicates_exceeds_persisted"]));
    expect(isRegionalCoordinate(-22.9, -43.2)).toBe(false);
  });

  it("preserves degraded state without inventing imported events", () => {
    const result = reconcileIngestionResult({ degraded: true });
    expect(result).toMatchObject({ degraded: true, counts: { read: 0, filtered: 0, persisted: 0 }, consistent: true });
  });
});
