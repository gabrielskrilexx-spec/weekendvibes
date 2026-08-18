import { archiveExpiredSoldOutEvents } from "./db";
import { runIngestionPipeline } from "./ingestion";
import { getMetaFailureStatus, isGracefullyDegradedMetaFailure, runInstagramPipeline } from "./instagram-pipeline";
import { processPendingGeocoding } from "./geocoding";
import { finishIngestionRun, startIngestionRun } from "./ingestion-reports";
import { reconcileIngestionResult } from "./reconciliation";

export type AgendaStepOptions = { archive?: boolean; track?: boolean; sourceKey?: string };

async function trackedStep<T>(routine: string, sourceKey: string, work: () => Promise<T>) {
  const runId = await startIngestionRun({ routine, sourceKey });
  try {
    const result = await work();
    const raw = result as Record<string, unknown>;
    const imported = Number(raw.imported ?? 0);
    const read = Number(raw.read ?? raw.receivedPosts ?? raw.discovered ?? 0);
    const filtered = Number(raw.filtered ?? Math.max(0, read - Number(raw.approvedPosts ?? raw.matchedSources ?? 0)));
    const reconciliation = reconcileIngestionResult({
      read,
      filtered,
      persisted: Number(raw.persisted ?? imported),
      duplicates: Number(raw.duplicates ?? 0),
      missingCoordinates: Number(raw.missingCoordinates ?? 0),
      outOfBoundsCoordinates: Number(raw.outOfBoundsCoordinates ?? 0),
      degraded: raw.degraded === true,
      retries: Number(raw.retries ?? 0),
      fallbackList: Number(raw.fallbackList ?? 0),
    });
    await finishIngestionRun(runId, { status: "succeeded", importedCount: imported, counts: reconciliation.counts, details: { ...raw, reconciliation }, routine, sourceKey });
    return result;
  } catch (error) {
    const degraded = sourceKey === "instagram" && isGracefullyDegradedMetaFailure(error);
    const upstreamStatus = degraded ? getMetaFailureStatus(error) ?? 503 : undefined;
    await finishIngestionRun(runId, {
      status: degraded ? "partial" : "failed",
      failedCount: degraded ? 0 : 1,
      httpStatus: degraded ? 200 : 500,
      counts: { read: 0, filtered: 0, persisted: 0 },
        details: degraded
        ? { degraded: true, integration: "meta", upstreamStatus, imported: 0, counts: { read: 0, filtered: 0, persisted: 0 }, reconciliation: reconcileIngestionResult({ degraded: true }) }
        : { message: error instanceof Error ? error.message : String(error), reconciliation: reconcileIngestionResult({}) },
      routine,
      sourceKey,
    });
    throw error;
  }
}

export async function runPublicAgendaStep(options: AgendaStepOptions = {}) {
  const execute = async () => {
    const archived = options.archive === false ? 0 : await archiveExpiredSoldOutEvents();
    const result = await runIngestionPipeline();
    return { archived, result };
  };
  return options.track === false ? execute() : trackedStep("public-agenda", options.sourceKey ?? "public", execute);
}

export async function runInstagramAgendaStep(options: AgendaStepOptions = {}) {
  const execute = async () => {
    const archived = options.archive === false ? 0 : await archiveExpiredSoldOutEvents();
    const result = await runInstagramPipeline();
    let geocoding = { processed: 0, succeeded: 0, failed: 0, pending: 0 };
    try {
      geocoding = await processPendingGeocoding(5);
    } catch (error) {
      console.warn("[Agenda routine] Geocoding batch skipped:", error);
    }
    return { archived, result, geocoding };
  };
  return options.track === false ? execute() : trackedStep("instagram-agenda", options.sourceKey ?? "instagram", execute);
}

export async function runFullAgendaRoutine() {
  const runId = await startIngestionRun({ routine: "full-agenda", sourceKey: "all" });
  try {
    const archived = await archiveExpiredSoldOutEvents();
    const [publicStep, instagramStep] = await Promise.all([
      runPublicAgendaStep({ archive: false, track: false }),
      runInstagramAgendaStep({ archive: false, track: false }),
    ]);
    const result = { archived, publicSources: publicStep.result, instagram: instagramStep.result };
    await finishIngestionRun(runId, { status: "succeeded", importedCount: Number(publicStep.result.imported ?? 0) + Number(instagramStep.result.imported ?? 0), details: result });
    return result;
  } catch (error) {
    await finishIngestionRun(runId, { status: "failed", failedCount: 1, details: { message: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

export async function runAgendaStepForScheduler(step: "public" | "instagram") {
  return step === "public" ? runPublicAgendaStep() : runInstagramAgendaStep();
}

export const AGENDA_ROUTINE_COMPOSITION = ["archiveExpiredSoldOutEvents", "runIngestionPipeline", "runInstagramPipeline"] as const;
