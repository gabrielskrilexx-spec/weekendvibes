import { describe, expect, it } from "vitest";
import { buildFreshnessCriticalAlert, buildReconciliationDivergenceAlert } from "./operational-alert-rules";

describe("automatic operational alert rules", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("does not create a freshness alert for healthy or delayed sources", () => {
    expect(buildFreshnessCriticalAlert({ sourceKey: "instagram", sourceName: "Instagram", state: "healthy", lastSuccessAt: now, expectedMinutes: 60, now })).toBeNull();
    expect(buildFreshnessCriticalAlert({ sourceKey: "instagram", sourceName: "Instagram", state: "delayed", lastSuccessAt: now, expectedMinutes: 60, now })).toBeNull();
  });

  it("creates a critical freshness alert with bounded SLA", () => {
    const alert = buildFreshnessCriticalAlert({ sourceKey: "public:ingresse", sourceName: "Ingresse", state: "critical", lastSuccessAt: new Date("2026-08-18T08:00:00.000Z"), expectedMinutes: 60, now });
    expect(alert).toMatchObject({ alertType: "freshness_critical", severity: "CRITICAL", slaMinutes: 60, integration: "pipeline" });
    expect(alert?.message).toContain("public:ingresse");
  });

  it("ignores consistent reconciliation results", () => {
    expect(buildReconciliationDivergenceAlert({ sourceKey: "instagram", consistent: true, issues: [], persisted: 2, read: 4, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0 })).toBeNull();
  });

  it("creates a warning for a non-critical reconciliation issue", () => {
    expect(buildReconciliationDivergenceAlert({ sourceKey: "public:ingresse", consistent: false, issues: ["missing_coordinates_exceeds_persisted"], persisted: 1, read: 2, duplicates: 0, missingCoordinates: 2, outOfBoundsCoordinates: 0 })).toMatchObject({ alertType: "reconciliation_divergence", severity: "WARNING", slaMinutes: 240 });
  });

  it("creates a critical alert for persisted counts that exceed read counts", () => {
    expect(buildReconciliationDivergenceAlert({ sourceKey: "instagram", runId: 42, consistent: false, issues: ["persisted_exceeds_read"], persisted: 4, read: 1, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0 })).toMatchObject({ alertType: "reconciliation_divergence", severity: "CRITICAL", slaMinutes: 60 });
  });
});
