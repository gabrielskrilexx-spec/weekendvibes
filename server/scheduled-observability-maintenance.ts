import { createCatalogSnapshot, deleteCatalogSnapshotsOlderThan, getConsolidatedIngestionSourceReport } from "./db";
import { runExecutiveObservabilityCycle } from "./scheduled-executive-report";

export async function runObservabilitySnapshotMaintenance(now = new Date()) {
  const observability = await runExecutiveObservabilityCycle(14);
  const snapshot = await createCatalogSnapshot(await getConsolidatedIngestionSourceReport());
  const deletedSnapshots = await deleteCatalogSnapshotsOlderThan(30, now);
  return {
    systemHealthStatus: observability.system_health_status,
    observedAt: observability.generatedAt,
    snapshot,
    deletedSnapshots,
  };
}
