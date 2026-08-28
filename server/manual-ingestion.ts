import { desc, eq, or } from "drizzle-orm";
import { ingestionRuns } from "../drizzle/schema";
import { getDb, recordOperationalAlert } from "./db";
import { listHeartbeatJobs } from "./_core/heartbeat";
import { notifyOwner } from "./_core/notification";
import { InstagramIntegrationFailure, runInstagramPipeline } from "./instagram-pipeline";
import { runFullAgendaRoutine, runPublicAgendaStep, runInstagramAgendaStep, type AgendaProgressUpdate } from "./agenda-routine";
import { finishIngestionRun, startIngestionRun } from "./ingestion-reports";
import { startAsyncApifyStoriesRun } from "./apify-async";

let activeRun: Promise<ManualRoutineResult> | null = null;

type ManualProgressSource = { sourceKey: "public" | "instagram"; status: "pending" | "running" | "succeeded" | "failed"; read: number; added: number; updated: number; ignored: number; error: string | null };
export type ManualRoutineProgress = { isRunning: boolean; runId: number | null; phase: AgendaProgressUpdate["phase"]; step: number; totalSteps: number; message: string; startedAt: string | null; updatedAt: string; error: string | null; sources: ManualProgressSource[] };

const initialManualProgress = (): ManualRoutineProgress => ({ isRunning: false, runId: null, phase: "completed", step: 4, totalSteps: 4, message: "Nenhuma execução em andamento.", startedAt: null, updatedAt: new Date().toISOString(), error: null, sources: [{ sourceKey: "public", status: "pending", read: 0, added: 0, updated: 0, ignored: 0, error: null }, { sourceKey: "instagram", status: "pending", read: 0, added: 0, updated: 0, ignored: 0, error: null }] });
let manualProgress = initialManualProgress();

function updateManualProgress(update: Partial<ManualRoutineProgress> & { sourceKey?: "public" | "instagram"; sourceStatus?: ManualProgressSource["status"]; metrics?: { read?: number; added?: number; updated?: number; ignored?: number }; error?: string | null }) {
  const sources = update.sourceKey ? manualProgress.sources.map(item => item.sourceKey === update.sourceKey ? { ...item, status: update.sourceStatus ?? item.status, read: update.metrics?.read ?? item.read, added: update.metrics?.added ?? item.added, updated: update.metrics?.updated ?? item.updated, ignored: update.metrics?.ignored ?? item.ignored, error: update.error ?? item.error } : item) : manualProgress.sources;
  const { sourceKey: _sourceKey, sourceStatus: _sourceStatus, metrics: _metrics, ...progressUpdate } = update;
  manualProgress = { ...manualProgress, ...progressUpdate, sources, updatedAt: new Date().toISOString() };
}

export function getManualRoutineProgress(): ManualRoutineProgress {
  return JSON.parse(JSON.stringify(manualProgress)) as ManualRoutineProgress;
}

export type ManualRoutineResult = {
  archived: number;
  publicSources: unknown;
  instagram: unknown;
  status?: "succeeded" | "partial" | "failed";
  automationSummary?: unknown;
  errors?: unknown;
  startedAt: string;
  finishedAt: string;
};

const getIntegration = (error: unknown) => error instanceof InstagramIntegrationFailure ? error.integration : "pipeline" as const;

async function executeRoutine(): Promise<ManualRoutineResult> {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  manualProgress = { ...initialManualProgress(), isRunning: true, phase: "starting", step: 0, message: "Preparando a ingestão manual.", startedAt };
  const manualRunId = await startIngestionRun({ routine: "manual-agenda", sourceKey: "manual" });
  updateManualProgress({ runId: manualRunId ?? null, phase: "starting", step: 0, message: manualRunId ? "Execução registrada; iniciando as fontes." : "Iniciando sem registro de auditoria disponível." });
  try {
    const result = await runFullAgendaRoutine({ trigger: "manual", runId: manualRunId, onProgress: update => updateManualProgress({ phase: update.phase, step: update.step, totalSteps: update.totalSteps, message: update.message, sourceKey: update.sourceKey, sourceStatus: update.sourceStatus, metrics: update.metrics, error: update.error ?? null }) });
    const finishedAt = new Date().toISOString();
    await finishIngestionRun(manualRunId, {
      routine: "manual-agenda",
      sourceKey: "manual",
      status: result.status ?? "succeeded",
      importedCount: typeof result.automationSummary === "object" && result.automationSummary !== null && "added" in result.automationSummary && "updated" in result.automationSummary ? Number((result.automationSummary as { added?: unknown; updated?: unknown }).added ?? 0) + Number((result.automationSummary as { added?: unknown; updated?: unknown }).updated ?? 0) : 0,
      durationMs: Date.now() - startedAtMs,
      details: { trigger: "manual", archived: result.archived, publicSources: result.publicSources, instagram: result.instagram, status: result.status, automationSummary: result.automationSummary, errors: result.errors },
    });
    updateManualProgress({ isRunning: false, phase: result.status === "failed" ? "failed" : "completed", step: 4, totalSteps: 4, message: result.status === "succeeded" ? "Ingestão concluída com sucesso." : result.status === "partial" ? "Ingestão concluída parcialmente; revise os erros." : "Ingestão concluída com falha crítica.", error: Array.isArray(result.errors) && result.errors.length > 0 ? "Uma ou mais fontes retornaram falhas sanitizadas." : null });
    return { ...result, startedAt, finishedAt };
  } catch (error) {
    updateManualProgress({ isRunning: false, phase: "failed", step: 4, totalSteps: 4, message: "A ingestão manual falhou; consulte o histórico de auditoria.", error: messageForProgress(error) });
    const integration = getIntegration(error);
    const message = error instanceof Error ? error.message : String(error);
    await finishIngestionRun(manualRunId, {
      routine: "manual-agenda",
      sourceKey: "manual",
      status: "failed",
      failedCount: 1,
      durationMs: Date.now() - startedAtMs,
      details: { trigger: "manual", error: "manual_ingestion_failed", integration },
    });
    try {
      await recordOperationalAlert({ integration, title: "Falha na execução manual da agenda", message });
    } catch (alertError) {
      console.warn("[Manual ingestion] Could not persist operational alert:", alertError);
    }
    try {
      await notifyOwner({ title: "Falha na execução manual da agenda", content: message });
    } catch (notificationError) {
      console.warn("[Manual ingestion] Could not notify project owner:", notificationError);
    }
    throw error;
  }
}

export function runWednesdayRoutineNow() {
  if (activeRun) return activeRun;
  activeRun = executeRoutine().finally(() => { activeRun = null; });
  return activeRun;
}

export function isWednesdayRoutineRunning() {
  return activeRun !== null;
}

function configuredSourceUrlsForChunks() {
  const raw = process.env.INGESTION_SOURCE_URLS ?? "";
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && value.startsWith("https://")) : [];
  } catch {
    return raw.split(/[\n,]+/).map(value => value.trim()).filter(value => value.startsWith("https://"));
  }
}
function sourceKeyForChunk(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("ingresse")) return "public:ingresse";
    if (host.includes("blacktag")) return "public:blacktag";
    if (host.includes("blackpass")) return "public:blackpass";
    if (host.includes("mringressos")) return "public:mringressos";
    if (host.includes("articket")) return "public:articket";
    if (host.endsWith("zig.tickets")) return "public:zig";
  } catch {
    // URL inválida não deve criar um chunk executável.
  }
  return "public:unknown";
}
export function getIngestionChunkSources() {
  const publicSources = configuredSourceUrlsForChunks().map(sourceKeyForChunk).filter(key => key !== "public:unknown");
  return Array.from(new Set([...publicSources, "instagram"]));
}

const CHUNK_TIMEOUT_MS = 8_000;

export async function withChunkTimeout<T>(work: Promise<T>, timeoutMs = CHUNK_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Tempo limite de 8 segundos excedido para esta fonte.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runIngestionSourceChunk(input: { sourceKey: string; dryRun?: boolean; storiesOnly?: boolean }) {
  const sourceKey = input.sourceKey.trim();
  if (sourceKey === "instagram") {
    if (input.dryRun) {
      return { sourceKey, dryRun: true, result: await withChunkTimeout(runInstagramPipeline({ dryRun: true, storiesOnly: input.storiesOnly === true })) };
    }
    if (input.storiesOnly) return { sourceKey, dryRun: false, result: await startAsyncApifyStoriesRun({ trigger: "manual" }) };
    return { sourceKey, dryRun: false, result: await withChunkTimeout(runInstagramAgendaStep({ archive: false, trigger: "manual" })) };
  }
  if (!/^public:[a-z0-9_-]+$/.test(sourceKey)) throw new Error("Fonte de ingestão inválida.");
  if (input.dryRun) {
    const { runIngestionPipeline } = await import("./ingestion");
    const result = await withChunkTimeout(runIngestionPipeline({ dryRun: true, sourceKey }));
    return { sourceKey, dryRun: true, result };
  }
  return { sourceKey, dryRun: false, result: await withChunkTimeout(runPublicAgendaStep({ archive: false, sourceKey, trigger: "manual" })) };
}

function messageForProgress(error: unknown) {
  return String(error instanceof Error ? error.message : error ?? "Falha não especificada").replace(/https?:\/\/[^\s]+/gi, "fonte pública").replace(/[\r\n\t]+/g, " ").trim().slice(0, 240);
}

export function getNextWednesdayExecution(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const localDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 13, 0, 0));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  let daysUntil = (3 - weekday + 7) % 7;
  if (daysUntil === 0 && localDate.getTime() <= now.getTime()) daysUntil = 7;
  localDate.setUTCDate(localDate.getUTCDate() + daysUntil);
  return localDate.toISOString();
}

async function getRecentInstagramRuns() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: ingestionRuns.id, routine: ingestionRuns.routine, sourceKey: ingestionRuns.sourceKey, status: ingestionRuns.status, startedAt: ingestionRuns.startedAt, finishedAt: ingestionRuns.finishedAt, httpStatus: ingestionRuns.httpStatus, durationMs: ingestionRuns.durationMs, importedCount: ingestionRuns.importedCount, details: ingestionRuns.details }).from(ingestionRuns).where(or(eq(ingestionRuns.sourceKey, "instagram"), eq(ingestionRuns.routine, "manual-agenda"), eq(ingestionRuns.routine, "instagram-stories-async"))).orderBy(desc(ingestionRuns.startedAt)).limit(6);
  return rows.map(row => {
    const parsedDetails = typeof row.details === "string" ? (() => { try { return JSON.parse(row.details) as unknown; } catch { return {}; } })() : row.details;
    const details = parsedDetails && typeof parsedDetails === "object" ? parsedDetails as Record<string, unknown> : {};
    const persistedEventIds = Array.isArray(details.persistedEventIds) ? details.persistedEventIds.filter((id): id is number => typeof id === "number") : [];
    const dateFilterValidation = details.dateFilterValidation && typeof details.dateFilterValidation === "object" ? details.dateFilterValidation : null;
    const instagramResult = details.instagram && typeof details.instagram === "object" ? details.instagram as Record<string, unknown> : {};
    const rawProviderIssue = instagramResult.providerIssue && typeof instagramResult.providerIssue === "object" ? instagramResult.providerIssue as Record<string, unknown> : undefined;
    const providerIssue = rawProviderIssue?.code === "APIFY_QUOTA_EXCEEDED" ? { code: "APIFY_QUOTA_EXCEEDED" as const, status: 403 as const, message: typeof rawProviderIssue.message === "string" ? rawProviderIssue.message.slice(0, 240) : "Cota mensal do Apify excedida." } : undefined;
    const rawAudit = Array.isArray(instagramResult.ocrAudit) ? instagramResult.ocrAudit : [];
    const ocrAudit = rawAudit.slice(0, 25).flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      const imageUrl = typeof value.imageUrl === "string" && value.imageUrl.startsWith("https://") ? value.imageUrl.slice(0, 1000) : "";
      const sourceUrl = typeof value.sourceUrl === "string" && value.sourceUrl.startsWith("https://") ? value.sourceUrl.slice(0, 1000) : "";
      const mediaOrigin = value.mediaOrigin === "story" || value.mediaOrigin === "highlight" || value.mediaOrigin === "post" ? value.mediaOrigin : "post";
      return [{ mediaOrigin, imageUrl, sourceUrl, highlightTitle: typeof value.highlightTitle === "string" ? value.highlightTitle.slice(0, 160) : null, ocrText: typeof value.ocrText === "string" ? value.ocrText.slice(0, 3000) : "", rawText: typeof value.rawText === "string" ? value.rawText.slice(0, 5000) : "" }];
    });
    return { id: row.id, routine: row.routine, sourceKey: row.sourceKey, trigger: details.trigger === "manual" ? "manual" : "automatic", status: row.status, startedAt: new Date(row.startedAt).toISOString(), finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null, httpStatus: row.httpStatus, durationMs: row.durationMs, importedCount: row.importedCount, expurgatedCount: typeof details.archived === "number" ? details.archived : 0, readCount: typeof details.receivedPosts === "number" ? details.receivedPosts : 0, processedCount: typeof details.structuredEvents === "number" ? details.structuredEvents : 0, persistedEventIds, dateFilterValidation, ocrAudit, providerIssue, quotaExceeded: providerIssue?.code === "APIFY_QUOTA_EXCEEDED" };
  });
}

export async function getWednesdayRoutineStatus(now = new Date()) {
  const recentRuns = await getRecentInstagramRuns();
  const fallback = {
    enabled: false,
    runMode: null as string | null,
    timezone: null as string | null,
    cron: null as string | null,
    nextExecutionAt: null as string | null,
    lastExecutedAt: recentRuns[0]?.finishedAt ?? null,
    isRunning: isWednesdayRoutineRunning(),
    progress: getManualRoutineProgress(),
    recentRuns,
    source: "metadata-unavailable" as const,
  };
  try {
    const { jobs } = await listHeartbeatJobs("", { page: 1, pageSize: 100 });
    const job = jobs.find(item => item.isEnable === true && item.cronExpression === "0 0 10 * * 3" && (!item.timezone || item.timezone === "America/Sao_Paulo") && (!item.runMode || item.runMode === "full_auto"));
    if (!job) return fallback;
    const hasCompleteMetadata = Boolean(job.timezone && job.runMode && job.nextExecutionAt);
    return {
      enabled: job.isEnable,
      runMode: job.runMode ?? "full_auto",
      timezone: job.timezone ?? "America/Sao_Paulo",
      cron: job.cronExpression,
      nextExecutionAt: job.nextExecutionAt ?? getNextWednesdayExecution(now),
      lastExecutedAt: recentRuns[0]?.finishedAt ?? job.lastExecutedAt ?? null,
      isRunning: isWednesdayRoutineRunning(),
      progress: getManualRoutineProgress(),
      recentRuns,
      source: (hasCompleteMetadata ? "heartbeat" : "heartbeat-derived") as "heartbeat" | "heartbeat-derived",
    };
  } catch (error) {
    console.warn("[Manual ingestion] Could not load Heartbeat metadata:", error);
    return fallback;
  }
}
