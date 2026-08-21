import { desc, eq, or } from "drizzle-orm";
import { ingestionRuns } from "../drizzle/schema";
import { getDb, recordOperationalAlert } from "./db";
import { listHeartbeatJobs } from "./_core/heartbeat";
import { notifyOwner } from "./_core/notification";
import { InstagramIntegrationFailure } from "./instagram-pipeline";
import { runFullAgendaRoutine } from "./agenda-routine";
import { finishIngestionRun, startIngestionRun } from "./ingestion-reports";

let activeRun: Promise<ManualRoutineResult> | null = null;

export type ManualRoutineResult = {
  archived: number;
  publicSources: unknown;
  instagram: unknown;
  startedAt: string;
  finishedAt: string;
};

const getIntegration = (error: unknown) => error instanceof InstagramIntegrationFailure ? error.integration : "pipeline" as const;

async function executeRoutine(): Promise<ManualRoutineResult> {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const manualRunId = await startIngestionRun({ routine: "manual-agenda", sourceKey: "manual" });
  try {
    const result = await runFullAgendaRoutine();
    const finishedAt = new Date().toISOString();
    await finishIngestionRun(manualRunId, {
      routine: "manual-agenda",
      sourceKey: "manual",
      status: "succeeded",
      importedCount: typeof result.instagram === "object" && result.instagram !== null && "persisted" in result.instagram && typeof result.instagram.persisted === "number" ? result.instagram.persisted : 0,
      durationMs: Date.now() - startedAtMs,
      details: { trigger: "manual", archived: result.archived, publicSources: result.publicSources, instagram: result.instagram },
    });
    return { ...result, startedAt, finishedAt };
  } catch (error) {
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
  const rows = await db.select({ id: ingestionRuns.id, routine: ingestionRuns.routine, sourceKey: ingestionRuns.sourceKey, status: ingestionRuns.status, startedAt: ingestionRuns.startedAt, finishedAt: ingestionRuns.finishedAt, httpStatus: ingestionRuns.httpStatus, durationMs: ingestionRuns.durationMs, importedCount: ingestionRuns.importedCount, details: ingestionRuns.details }).from(ingestionRuns).where(or(eq(ingestionRuns.sourceKey, "instagram"), eq(ingestionRuns.routine, "manual-agenda"))).orderBy(desc(ingestionRuns.startedAt)).limit(6);
  return rows.map(row => {
    const parsedDetails = typeof row.details === "string" ? (() => { try { return JSON.parse(row.details) as unknown; } catch { return {}; } })() : row.details;
    const details = parsedDetails && typeof parsedDetails === "object" ? parsedDetails as Record<string, unknown> : {};
    const persistedEventIds = Array.isArray(details.persistedEventIds) ? details.persistedEventIds.filter((id): id is number => typeof id === "number") : [];
    const dateFilterValidation = details.dateFilterValidation && typeof details.dateFilterValidation === "object" ? details.dateFilterValidation : null;
    return { id: row.id, routine: row.routine, sourceKey: row.sourceKey, trigger: details.trigger === "manual" ? "manual" : "automatic", status: row.status, startedAt: new Date(row.startedAt).toISOString(), finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null, httpStatus: row.httpStatus, durationMs: row.durationMs, importedCount: row.importedCount, expurgatedCount: typeof details.archived === "number" ? details.archived : 0, readCount: typeof details.receivedPosts === "number" ? details.receivedPosts : 0, processedCount: typeof details.structuredEvents === "number" ? details.structuredEvents : 0, persistedEventIds, dateFilterValidation };
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
      recentRuns,
      source: (hasCompleteMetadata ? "heartbeat" : "heartbeat-derived") as "heartbeat" | "heartbeat-derived",
    };
  } catch (error) {
    console.warn("[Manual ingestion] Could not load Heartbeat metadata:", error);
    return fallback;
  }
}
