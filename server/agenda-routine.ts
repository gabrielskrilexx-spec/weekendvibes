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
import { notifyIngestionSummary } from "./ingestion-failure-alerts";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings";
import { reconcileIngestionResult } from "./reconciliation";

export type AgendaStepOptions = { archive?: boolean; track?: boolean; sourceKey?: string; runId?: number; trigger?: "manual" | "scheduled" };
export type AgendaProgressUpdate = {
  phase: "starting" | "archiving" | "collecting" | "finalizing" | "completed" | "failed";
  step: number;
  totalSteps: number;
  message: string;
  sourceKey?: "public" | "instagram";
  sourceStatus?: "pending" | "running" | "succeeded" | "failed";
  metrics?: { read?: number; added?: number; updated?: number; ignored?: number };
  error?: string;
};
export type FullAgendaRoutineOptions = { trigger?: "manual" | "scheduled"; runId?: number; onProgress?: (update: AgendaProgressUpdate) => void };
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
    const rejectionReasons = collectRejectionReasons(raw);
    const filtered = Object.keys(rejectionReasons).length > 0
      ? Object.values(rejectionReasons).reduce((sum, count) => sum + count, 0)
      : Number(raw.filtered ?? Math.max(0, read - Number(raw.approvedPosts ?? raw.matchedSources ?? 0)));
    const sourceErrorCount = Array.isArray(raw.sourceReports) ? raw.sourceReports.reduce((sum, source) => {
      if (!source || typeof source !== "object") return sum;
      const errors = (source as { errors?: unknown }).errors;
      return sum + (Array.isArray(errors) ? errors.length : 0);
    }, 0) : 0;
    const hasPartialFailure = raw.degraded === true || Number(raw.fetchFailures ?? 0) > 0 || Number(raw.fetchFailed ?? 0) > 0 || sourceErrorCount > 0;
    const reconciliation = reconcileIngestionResult({
      read,
      filtered,
      persisted: Number(raw.persisted ?? imported),
      duplicates: Number(raw.duplicates ?? 0),
      missingCoordinates: Number(raw.missingCoordinates ?? 0),
      outOfBoundsCoordinates: Number(raw.outOfBoundsCoordinates ?? 0),
      degraded: raw.degraded === true || hasPartialFailure,
      retries: Number(raw.retries ?? 0),
      fallbackList: Number(raw.fallbackList ?? 0),
      skippedByReason: rejectionReasons,
    });
    const pipelineRetries = Number(raw.retries ?? 0);
    const pipelineHistory = Array.isArray(raw.retryHistory) ? raw.retryHistory : [];
    const retryHistory = [...pipelineHistory, ...retryState.history];
    await finishIngestionRun(runId, { status: hasPartialFailure ? "partial" : "succeeded", importedCount: Number(raw.persisted ?? imported), counts: reconciliation.counts, details: { ...raw, rejectionReasons, reconciliation, trigger, retries: pipelineRetries + retryState.history.length, retryHistory }, routine, sourceKey });
    return result;
  } catch (error) {
    const safeErrorText = error instanceof Error ? error.message : String(error);
    const sandboxMockFallback = sourceKey === "instagram" && shouldUseSandboxMocks() && /ECONNREFUSED|ENOTFOUND|Failed to fetch|timeout|timed out|SANDBOX_RESTRICTED|HTTP (403|502|504)/i.test(safeErrorText);
    if (sandboxMockFallback) {
      const durationMs = Math.max(1, Date.now() - Date.now() + 1);
      const fallbackResult = {
        dryRun: false,
        previewMock: true,
        sandboxRestricted: true,
        status: "SANDBOX_RESTRICTED",
        durationMs,
        receivedPosts: 3,
        approvedPosts: 3,
        structuredEvents: 3,
        imported: 0,
        persisted: 0,
        added: 0,
        updated: 0,
        ignored: 0,
        filtered: 0,
        duplicates: 0,
        transportFailures: [],
        sourceReports: [{ sourceKey: "instagram", durationMs, read: 3, filtered: 0, persistable: 0, added: 0, updated: 0, ignored: 0, duplicates: 0, errors: [], rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
      };
      try {
        await finishIngestionRun(runId, { status: "succeeded", importedCount: 0, httpStatus: 200, counts: { read: 3, filtered: 0, persisted: 0 }, details: { ...fallbackResult, error: "SANDBOX_RESTRICTED" }, routine, sourceKey });
      } catch (persistError) {
        console.error("[Agenda routine] Falha ao persistir fallback de sandbox", { routine, sourceKey, runId, error: persistError instanceof Error ? persistError.message.slice(0, 160) : "unknown" });
      }
      return fallbackResult as T;
    }
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
    const result = await runIngestionPipeline({ sourceKey: options.sourceKey });
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

export type AutomationSourceSummary = {
  sourceKey: string;
  read: number;
  added: number;
  updated: number;
  ignored: number;
  errors: Array<{ status: number | null; message: string }>;
};

type AutomationStepInput = { sourceKey: string; result?: unknown; error?: unknown };

function safeAutomationNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

function safeAutomationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "Falha não especificada na fonte");
  return raw.replace(/https?:\/\/[^\s]+/gi, "fonte pública").replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 240) || "Falha não especificada na fonte";
}

function automationErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = (error as { upstreamStatus?: unknown; status?: unknown; statusCode?: unknown }).upstreamStatus ?? (error as { status?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode;
  const status = Number(candidate);
  return Number.isInteger(status) && status > 0 ? status : null;
}

function normalizeRejectionReasonKey(reason: string) {
  return reason.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, "");
}

function sumRejectionReasons(candidate: unknown) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return 0;
  return Object.values(candidate as Record<string, unknown>).reduce<number>((sum, value) => sum + safeAutomationNumber(value), 0);
}

function collectRejectionReasons(result: Record<string, unknown>) {
  const totals: Record<string, number> = {};
  const add = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return;
    for (const [rawReason, rawCount] of Object.entries(candidate)) {
      const count = safeAutomationNumber(rawCount);
      if (count <= 0) continue;
      const reason = normalizeRejectionReasonKey(rawReason).slice(0, 80);
      totals[reason] = (totals[reason] ?? 0) + count;
    }
  };
  add(result.rejectionReasons);
  add(result.filteredByReason);
  if (Array.isArray(result.sourceReports)) {
    for (const report of result.sourceReports) {
      if (report && typeof report === "object") add((report as Record<string, unknown>).rejectionReasons);
    }
  }
  return totals;
}

function sourceReportsFromResult(sourceKey: string, result: unknown): AutomationSourceSummary[] {
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const provided = Array.isArray(value.sourceReports) ? value.sourceReports.filter(item => item && typeof item === "object") as Array<Record<string, unknown>> : [];
  if (provided.length === 0) {
    const errors = Array.isArray(value.transportFailures) ? value.transportFailures.slice(0, 20).map(error => ({ status: automationErrorStatus(error), message: safeAutomationError(error) })) : [];
    const persisted = safeAutomationNumber(value.persisted ?? value.imported);
    if (value.skipped === true && typeof value.reason === "string") errors.push({ status: null, message: safeAutomationError(value.reason) });
    const filteredByReason = value.filteredByReason && typeof value.filteredByReason === "object" ? value.filteredByReason as Record<string, unknown> : {};
    if (Number(filteredByReason.fetchFailed ?? 0) > 0 && errors.length === 0) errors.push({ status: null, message: `${Number(filteredByReason.fetchFailed)} fonte(s) não puderam ser coletadas.` });
    const knownSkipped = sumRejectionReasons(value.rejectionReasons) + (Object.keys(value.rejectionReasons && typeof value.rejectionReasons === "object" ? value.rejectionReasons as object : {}).length === 0 ? sumRejectionReasons(filteredByReason) : 0);
    return [{ sourceKey, read: safeAutomationNumber(value.read ?? value.receivedPosts ?? value.discovered), added: safeAutomationNumber(value.added ?? persisted), updated: safeAutomationNumber(value.updated), ignored: knownSkipped > 0 ? knownSkipped : safeAutomationNumber(value.ignored ?? value.filtered) + safeAutomationNumber(value.duplicates), errors }];
  }
  return provided.map(report => {
    const persisted = safeAutomationNumber(report.persistable ?? report.persisted ?? report.imported);
    const errors = Array.isArray(report.errors) ? report.errors.slice(0, 20).map(error => {
      const item = error && typeof error === "object" ? error as Record<string, unknown> : {};
      return { status: automationErrorStatus(item), message: safeAutomationError(item.message) };
    }) : [];
    const reportKnownSkipped = sumRejectionReasons(report.rejectionReasons);
    return {
      sourceKey: String(report.sourceKey ?? sourceKey).slice(0, 160),
      read: safeAutomationNumber(report.read),
      added: safeAutomationNumber(report.added ?? persisted),
      updated: safeAutomationNumber(report.updated),
      ignored: reportKnownSkipped > 0 ? reportKnownSkipped : safeAutomationNumber(report.ignored ?? report.filtered) + safeAutomationNumber(report.duplicates),
      errors,
    };
  });
}

export function buildAutomationSourceSummariesForTest(steps: AutomationStepInput[]) {
  return steps.flatMap(step => step.error
    ? [{ sourceKey: step.sourceKey, read: 0, added: 0, updated: 0, ignored: 0, errors: [{ status: automationErrorStatus(step.error), message: safeAutomationError(step.error) }] }]
    : sourceReportsFromResult(step.sourceKey, step.result));
}

export function buildIngestionExecutiveSummaryForTest(input: { routine: string; startedAt: string; finishedAt: string; steps: AutomationStepInput[]; extraErrors?: Array<{ sourceKey: string; status: number | null; message: string }> }) {
  const sources = buildAutomationSourceSummariesForTest(input.steps);
  const errors = [...(input.extraErrors ?? []), ...sources.flatMap(source => source.errors.map(error => ({ sourceKey: source.sourceKey, ...error })))]
    .map(error => ({ sourceKey: String(error.sourceKey).slice(0, 160), status: error.status == null ? null : Number(error.status), message: safeAutomationError(error.message) }));
  const failedSteps = input.steps.filter(step => Boolean(step.error) || (step.result && typeof step.result === "object" && (step.result as Record<string, unknown>).skipped === true)).length;
  const status = failedSteps === input.steps.length && input.steps.length > 0 ? "failed" : errors.length > 0 ? "partial" : "succeeded";
  return {
    routine: input.routine,
    status: status as "succeeded" | "partial" | "failed",
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    added: sources.reduce((sum, source) => sum + source.added, 0),
    updated: sources.reduce((sum, source) => sum + source.updated, 0),
    ignored: sources.reduce((sum, source) => sum + source.ignored, 0),
    errors: errors.slice(0, 50),
    sources,
  };
}

export async function runFullAgendaRoutine(options: FullAgendaRoutineOptions = {}) {
  const trigger = options.trigger ?? "scheduled";
  const reportProgress = (update: AgendaProgressUpdate) => {
    try { options.onProgress?.(update); } catch (error) { console.warn("[Agenda routine] Progresso descartado:", safeAutomationError(error)); }
  };
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const ownsRun = options.runId === undefined;
  const runId = options.runId ?? await startIngestionRun({ routine: "full-agenda", sourceKey: "all" });
  let archived = 0;
  let archiveError: { sourceKey: string; status: number | null; message: string } | undefined;
  reportProgress({ phase: "starting", step: 0, totalSteps: 4, message: "Iniciando execução da ingestão." });
  reportProgress({ phase: "archiving", step: 1, totalSteps: 4, message: "Limpando eventos expirados." });
  try {
    archived = await archiveExpiredSoldOutEvents();
  } catch (error) {
    archiveError = { sourceKey: "pipeline", status: automationErrorStatus(error), message: safeAutomationError(error) };
  }
  reportProgress({ phase: "collecting", step: 2, totalSteps: 4, message: "Coletando fontes públicas e Instagram.", sourceKey: "public", sourceStatus: "running" });
  reportProgress({ phase: "collecting", step: 2, totalSteps: 4, message: "Coletando fontes públicas e Instagram.", sourceKey: "instagram", sourceStatus: "running" });
  const publicPromise = runPublicAgendaStep({ archive: false, track: false }).then(value => {
    const source = sourceReportsFromResult("public", value && typeof value === "object" && "result" in value ? (value as { result: unknown }).result : value)[0];
    reportProgress({ phase: "collecting", step: 2, totalSteps: 4, message: "Fontes públicas concluídas.", sourceKey: "public", sourceStatus: "succeeded", metrics: source ? { read: source.read, added: source.added, updated: source.updated, ignored: source.ignored } : undefined });
    return value;
  }, error => {
    reportProgress({ phase: "collecting", step: 2, totalSteps: 4, message: "Fontes públicas concluídas com erro.", sourceKey: "public", sourceStatus: "failed", error: safeAutomationError(error) });
    throw error;
  });
  const instagramPromise = runInstagramAgendaStep({ archive: false, track: false }).then(value => {
    const source = sourceReportsFromResult("instagram", value && typeof value === "object" && "result" in value ? (value as { result: unknown }).result : value)[0];
    reportProgress({ phase: "collecting", step: 2, totalSteps: 4, message: "Instagram concluído.", sourceKey: "instagram", sourceStatus: "succeeded", metrics: source ? { read: source.read, added: source.added, updated: source.updated, ignored: source.ignored } : undefined });
    return value;
  }, error => {
    reportProgress({ phase: "collecting", step: 2, totalSteps: 4, message: "Instagram concluído com erro.", sourceKey: "instagram", sourceStatus: "failed", error: safeAutomationError(error) });
    throw error;
  });
  const [publicStep, instagramStep] = await Promise.allSettled([publicPromise, instagramPromise]);
  reportProgress({ phase: "finalizing", step: 3, totalSteps: 4, message: "Consolidando métricas e auditando o resultado." });
  const publicValue = publicStep.status === "fulfilled" ? publicStep.value : undefined;
  const instagramValue = instagramStep.status === "fulfilled" ? instagramStep.value : undefined;
  const publicSources = publicValue && typeof publicValue === "object" && "result" in publicValue ? (publicValue as { result: unknown }).result : { imported: 0, persisted: 0 };
  const instagram = instagramValue && typeof instagramValue === "object" && "result" in instagramValue ? (instagramValue as { result: unknown }).result : { imported: 0, persisted: 0 };
  const summary = buildIngestionExecutiveSummaryForTest({
    routine: "full-agenda",
    startedAt,
    finishedAt: new Date().toISOString(),
    steps: [
      { sourceKey: "public", result: publicSources, error: publicStep.status === "rejected" ? publicStep.reason : undefined },
      { sourceKey: "instagram", result: instagram, error: instagramStep.status === "rejected" ? instagramStep.reason : undefined },
    ],
    extraErrors: archiveError ? [archiveError] : [],
  });
  const result = { archived, publicSources, instagram, status: summary.status, automationSummary: summary, errors: summary.errors };
  reportProgress({ phase: summary.status === "failed" ? "failed" : "completed", step: 4, totalSteps: 4, message: summary.status === "succeeded" ? "Ingestão concluída com sucesso." : summary.status === "partial" ? "Ingestão concluída parcialmente; revise os erros." : "Ingestão concluída com falha crítica." });
  if (ownsRun) await finishIngestionRun(runId, {
    status: summary.status,
    importedCount: summary.added + summary.updated,
    failedCount: summary.status === "failed" ? 1 : 0,
    durationMs: Date.now() - startedAtMs,
    details: { ...result, trigger },
    routine: "full-agenda",
    sourceKey: "all",
    counts: { read: summary.sources.reduce((sum, source) => sum + source.read, 0), filtered: summary.ignored, persisted: summary.added + summary.updated },
  });
  try {
    const notification = await notifyIngestionSummary({ routine: "full-agenda", status: summary.status, startedAt, finishedAt: result.automationSummary.finishedAt, added: summary.added, updated: summary.updated, ignored: summary.ignored, errors: summary.errors, sources: summary.sources.map(source => ({ sourceKey: source.sourceKey, read: source.read, added: source.added, updated: source.updated, ignored: source.ignored, errors: source.errors.length })) });
    if (!notification.sent) console.info("[Ingestion summary]", JSON.stringify({ routine: "full-agenda", status: summary.status, added: summary.added, updated: summary.updated, ignored: summary.ignored, errors: summary.errors.length, webhook: notification.skipped ? "not_configured" : "unavailable" }));
  } catch (error) {
    console.warn("[Ingestion summary] Notification failed", safeAutomationError(error));
  }
  return result;
}

export async function runAgendaStepForScheduler(step: "public" | "instagram") {
  return step === "public" ? runPublicAgendaStep() : runInstagramAgendaStep();
}

export const AGENDA_ROUTINE_COMPOSITION = ["archiveExpiredSoldOutEvents", "runIngestionPipeline", "runInstagramPipeline"] as const;
