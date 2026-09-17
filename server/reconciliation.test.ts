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

  it("closes the accounting equation with legitimate past_event discards", () => {
    const result = reconcileIngestionResult({
      read: 109,
      persisted: 0,
      skippedByReason: { past_event: 103, duplicate: 6 },
    });
    expect(result.allKnownSkipped).toBe(109);
    expect(result.reconciliationGap).toBe(0);
    expect(result.consistent).toBe(true);
    expect(result.issues).not.toContain("reconciliation_gap");
  });

  it("closes Instagram accounting when 200 items are read and two are persisted", () => {
    const result = reconcileIngestionResult({ read: 200, persisted: 2, skippedByReason: { past_event: 120, invalid_schema: 78 } });
    expect(result.reconciliationGap).toBe(0);
    expect(result.counts).toEqual({ read: 200, filtered: 198, persisted: 2 });
    expect(result.consistent).toBe(true);
  });

  it("flags only items with unknown destinations", () => {
    const result = reconcileIngestionResult({
      read: 109,
      persisted: 0,
      skippedByReason: { past_event: 103, duplicate: 5 },
    });
    expect(result.reconciliationGap).toBe(1);
    expect(result.consistent).toBe(false);
    expect(result.issues).toContain("reconciliation_gap");
  });

  it("counts supplied filtered items only once against the remaining capacity", () => {
    const result = reconcileIngestionResult({
      read: 10,
      persisted: 4,
      filtered: 9,
      skippedByReason: { past_event: 6, invalid_schema: 3 },
    });

    expect(result.counts.filtered).toBe(6);
    expect(result.skippedByReason).toEqual({ past_event: 6 });
    expect(result.allKnownSkipped).toBe(6);
    expect(result.reconciliationGap).toBe(0);
    expect(result.issues).toContain("filtered_exceeds_read");
    expect(result.issues).not.toContain("reconciliation_gap");
  });
});
