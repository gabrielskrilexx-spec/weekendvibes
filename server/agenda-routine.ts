import { archiveExpiredSoldOutEvents } from "./db";
import { runIngestionPipeline } from "./ingestion";
import { getMetaFailureStatus, isGracefullyDegradedMetaFailure, runInstagramPipeline } from "./instagram-pipeline";

export class AgendaStepFailure extends Error {
  constructor(
    message: string,
    readonly integration: "meta" | "ocr" | "openai" | "pipeline",
    readonly upstreamStatus?: number,
    readonly degraded = false,
  ) {
    super(message);
    this.name = "AgendaStepFailure";
  }
}
import { processPendingGeocoding } from "./geocoding";
import { finishIngestionRun, startIngestionRun } from "./ingestion-reports";
import { reconcileIngestionResult } from "./reconciliation";

export type AgendaStepOptions = { archive?: boolean; track?: boolean; sourceKey?: string; runId?: number; trigger?: "manual" | "scheduled" };
export type RetryAttempt = { attempt: number; startedAt: string; failedAt: string; reason: string; httpStatus: number | null };
const MAX_SCHEDULED_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export function isRetryableAgendaErrorForTest(error: unknown) {
  const status = error && typeof error === "object" && "upstreamStatus" in error ? Number((error as { upstreamStatus?: unknown }).upstreamStatus) : 0;
  if (status >= 400 && status < 500) return false;
  const message = error instanceof Error ? error.message : String(error);
  return status >= 500 || /timeout|timed out|fetch failed|network|econn|temporarily unavailable|http\s*5\d{2}|status\s*5\d{2}/i.test(message);
}

function retryHttpStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const status = (error as { upstreamStatus?: unknown; status?: unknown }).upstreamStatus ?? (error as { status?: unknown }).status;
  return Number.isInteger(Number(status)) && Number(status) > 0 ? Number(status) : null;
}

export async function runScheduledWithRetriesForTest<T>(work: () => Promise<T>, enabled: boolean, state: { history: RetryAttempt[] }, baseDelayMs = RETRY_BASE_DELAY_MS) {
  let attempt = 1;
  while (true) {
    const startedAt = new Date().toISOString();
    try {
      return await work();
    } catch (error) {
      const failedAt = new Date().toISOString();
      if (!enabled || !isRetryableAgendaErrorForTest(error) || attempt >= MAX_SCHEDULED_RETRIES) throw error;
      state.history.push({ attempt, startedAt, failedAt, reason: sanitizeAgendaStepErrorForTest(error, "pipeline", retryHttpStatus(error)), httpStatus: retryHttpStatus(error) });
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
      attempt += 1;
    }
  }
}

export function sanitizeAgendaStepErrorForTest(error: unknown, sourceKey: string, upstreamStatus?: number | null, degraded = false) {
  if (sourceKey === "instagram") {
    if (upstreamStatus === 400) return "Falha na integração Meta (HTTP 400)";
    if (degraded) return "Execução degradada da integração Meta";
    if (upstreamStatus) return `Falha na integração Meta (HTTP ${upstreamStatus})`;
    return "Falha na integração Meta";
  }
  return error instanceof Error ? error.message.slice(0, 240) : "Falha durante a execução da agenda";
}

export function normalizeTrackedStepResultForTest(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") return {};
  const outer = result as Record<string, unknown>;
  if (outer.result && typeof outer.result === "object" && !Array.isArray(outer.result)) {
    return outer.result as Record<string, unknown>;
  }
  return outer;
}

async function trackedStep<T>(routine: string, sourceKey: string, work: () => Promise<T>, options: AgendaStepOptions = {}) {
  const runId = options.runId ?? await startIngestionRun({ routine, sourceKey });
  const trigger = options.trigger ?? "scheduled";
  const retryState = { history: [] as RetryAttempt[] };
  try {
    const result = await runScheduledWithRetriesForTest(work, trigger === "scheduled", retryState);
    const raw = normalizeTrackedStepResultForTest(result);
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
    const pipelineRetries = Number(raw.retries ?? 0);
    const pipelineHistory = Array.isArray(raw.retryHistory) ? raw.retryHistory : [];
    const retryHistory = [...pipelineHistory, ...retryState.history];
    await finishIngestionRun(runId, { status: "succeeded", importedCount: imported, counts: reconciliation.counts, details: { ...raw, reconciliation, trigger, retries: pipelineRetries + retryState.history.length, retryHistory }, routine, sourceKey });
    return result;
  } catch (error) {
    const degraded = sourceKey === "instagram" && isGracefullyDegradedMetaFailure(error);
    const upstreamStatus = sourceKey === "instagram" ? getMetaFailureStatus(error) : undefined;
    const blockedCredentials = sourceKey === "instagram" && upstreamStatus === 400;
    const safeMessage = sanitizeAgendaStepErrorForTest(error, sourceKey, upstreamStatus, degraded);
    try {
      await finishIngestionRun(runId, {
        status: degraded ? "partial" : "failed",
        failedCount: degraded ? 0 : 1,
        httpStatus: degraded ? 200 : blockedCredentials ? 400 : 500,
        counts: { read: 0, filtered: 0, persisted: 0 },
        details: degraded
          ? { degraded: true, integration: "meta", upstreamStatus, imported: 0, counts: { read: 0, filtered: 0, persisted: 0 }, reconciliation: reconcileIngestionResult({ degraded: true }), trigger, retries: retryState.history.length, retryHistory: retryState.history }
          : blockedCredentials
            ? { integration: "meta", blocked_credentials: true, upstreamStatus: 400, error: "meta_credentials_or_permissions", counts: { read: 0, filtered: 0, persisted: 0 }, reconciliation: reconcileIngestionResult({}), trigger, retries: retryState.history.length, retryHistory: retryState.history }
            : { message: safeMessage, reconciliation: reconcileIngestionResult({}), trigger, retries: retryState.history.length, retryHistory: retryState.history },
        routine,
        sourceKey,
      });
    } catch (persistError) {
      console.error("[Agenda routine] Falha ao persistir resultado sanitizado", {
        routine,
        sourceKey,
        runId,
        error: persistError instanceof Error ? persistError.message.slice(0, 160) : "unknown",
      });
    }
    const integration = sourceKey === "instagram" && error && typeof error === "object" && "integration" in error
      ? String((error as { integration?: unknown }).integration)
      : sourceKey === "instagram" ? "meta" : "pipeline";
    const normalizedIntegration = integration === "ocr" || integration === "openai" || integration === "meta" ? integration : "pipeline";
    throw new AgendaStepFailure(safeMessage, normalizedIntegration, upstreamStatus ?? undefined, degraded);
  }
}

export async function runPublicAgendaStep(options: AgendaStepOptions = {}) {
  const execute = async () => {
    const archived = options.archive === false ? 0 : await archiveExpiredSoldOutEvents();
    const result = await runIngestionPipeline();
    return { archived, result };
  };
  return options.track === false ? execute() : trackedStep("public-agenda", options.sourceKey ?? "public", execute, options);
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
  return options.track === false ? execute() : trackedStep("instagram-agenda", options.sourceKey ?? "instagram", execute, options);
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
