import { and, desc, eq, gte, sql } from "drizzle-orm";
import { ingestionRuns, operationalAlerts } from "../drizzle/schema";
import { getDb, recordOperationalAlert } from "./db";

export function isCriticalIngestionFailure(details: unknown) {
  const text = typeof details === "string" ? details : JSON.stringify(details ?? "");
  return /timeout|http\s*5\d{2}|status\s*5\d{2}|\b5\d{2}\b|http\s*200[^\n]*(zero|0)[^\n]*(mídia|media)/i.test(text);
}

function parseDetails(details: unknown): unknown {
  if (typeof details !== "string") return details;
  try { return JSON.parse(details); } catch { return details; }
}

function findMetric(details: unknown, key: string): number {
  if (!details || typeof details !== "object") return 0;
  const record = details as Record<string, unknown>;
  if (typeof record[key] === "number") return Number(record[key]);
  for (const value of Object.values(record)) {
    const found = findMetric(value, key);
    if (found !== 0) return found;
  }
  return 0;
}

function isInstagramRun(run: { routine: string; sourceKey: string | null }) {
  return run.sourceKey === "instagram" || run.routine === "instagram-agenda";
}

function isZeroMediaMetaRun(run: { routine: string; sourceKey: string | null }, details: unknown) {
  return isInstagramRun(run) && findMetric(details, "receivedPosts") === 0;
}

function saoPauloDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function buildWeeklyTrend(runs: Array<{ routine: string; sourceKey: string | null; status: string; importedCount: number; startedAt: Date; details: unknown }>) {
  const today = new Date();
  const buckets = new Map<string, { date: string; label: string; runs: number; succeeded: number; failed: number; partial: number; receivedPosts: number; approvedPosts: number; structuredEvents: number; imported: number; zeroMediaRuns: number }>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    const key = saoPauloDayKey(date);
    buckets.set(key, { date: key, label: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date), runs: 0, succeeded: 0, failed: 0, partial: 0, receivedPosts: 0, approvedPosts: 0, structuredEvents: 0, imported: 0, zeroMediaRuns: 0 });
  }
  for (const run of runs) {
    const bucket = buckets.get(saoPauloDayKey(new Date(run.startedAt)));
    if (!bucket) continue;
    const details = parseDetails(run.details);
    bucket.runs += 1;
    bucket.succeeded += run.status === "succeeded" ? 1 : 0;
    bucket.failed += run.status === "failed" ? 1 : 0;
    bucket.partial += run.status === "partial" ? 1 : 0;
    bucket.imported += Number(run.importedCount ?? 0);
    bucket.receivedPosts += findMetric(details, "receivedPosts");
    bucket.approvedPosts += findMetric(details, "approvedPosts");
    bucket.structuredEvents += findMetric(details, "structuredEvents");
    bucket.zeroMediaRuns += isZeroMediaMetaRun(run, details) ? 1 : 0;
  }
  return Array.from(buckets.values());
}

export async function startIngestionRun(input: { routine: string; sourceKey?: string }) {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db.insert(ingestionRuns).values({ routine: input.routine.slice(0, 64), sourceKey: input.sourceKey?.slice(0, 255), status: "running" });
    return Number(result[0].insertId);
  } catch (error) {
    console.warn("[Ingestion reports] Could not start run record:", error);
    return undefined;
  }
}

export async function finishIngestionRun(id: number | undefined, input: { status: "succeeded" | "failed" | "partial"; importedCount?: number; failedCount?: number; details?: unknown; routine?: string; sourceKey?: string }) {
  if (!id) return;
  try {
    const db = await getDb();
    if (!db) return;
    const serializedDetails = input.details ? JSON.stringify(input.details).slice(0, 20000) : null;
    await db.update(ingestionRuns).set({ status: input.status, importedCount: input.importedCount ?? 0, failedCount: input.failedCount ?? 0, details: serializedDetails, finishedAt: new Date() }).where(eq(ingestionRuns.id, id));
    const failureText = serializedDetails ?? "";
    if (input.status === "failed" && isCriticalIngestionFailure(failureText)) {
      await recordOperationalAlert({ dbOverride: db, integration: "pipeline", title: "Falha crítica na ingestão", message: `A rotina ${id} registrou timeout ou erro HTTP 5xx: ${failureText}` });
    }
    const runShape = { routine: input.routine ?? "", sourceKey: input.sourceKey ?? null };
    if (input.status === "succeeded" && isZeroMediaMetaRun(runShape, input.details)) {
      await recordOperationalAlert({ dbOverride: db, integration: "meta", title: "Meta respondeu HTTP 200 sem mídias", message: "A API oficial da Meta respondeu HTTP 200, mas não retornou mídias para os perfis monitorados. Verifique permissões do Business Discovery, vínculo Página–Instagram e validade do token." });
    }
  } catch (error) {
    console.warn("[Ingestion reports] Could not finish run record:", error);
  }
}

export type MetaIntegrationStatus = {
  status: "active" | "degraded" | "failed" | "never";
  lastSuccessfulSync: string | null;
  lastAttempt: string | null;
};

export function buildMetaIntegrationStatusForTest(runs: Array<{ status: string; startedAt: Date; finishedAt?: Date | null }>): MetaIntegrationStatus {
  const ordered = [...runs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const latest = ordered[0];
  const successful = ordered.find(run => run.status === "succeeded");
  const status = latest?.status === "succeeded" ? "active" : latest?.status === "failed" ? "failed" : latest ? "degraded" : "never";
  return {
    status,
    lastSuccessfulSync: successful ? (successful.finishedAt ?? successful.startedAt).toISOString() : null,
    lastAttempt: latest ? latest.startedAt.toISOString() : null,
  };
}

export async function listIngestionReport(size = 20) {
  const db = await getDb();
  if (!db) return { runs: [], alerts: [], criticalAlerts: [], sourceMetrics: [], weeklyTrend: [], metaStatus: { status: "never" as const, lastSuccessfulSync: null, lastAttempt: null }, totals: { succeeded: 0, failed: 0, partial: 0, imported: 0 } };
  const safeSize = Math.min(Math.max(size, 1), 50);
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const runs = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(safeSize);
  const trendRuns = await db.select().from(ingestionRuns).where(gte(ingestionRuns.startedAt, cutoff)).orderBy(desc(ingestionRuns.startedAt)).limit(500);
  const metaRuns = await db.select({ status: ingestionRuns.status, startedAt: ingestionRuns.startedAt, finishedAt: ingestionRuns.finishedAt }).from(ingestionRuns).where(eq(ingestionRuns.sourceKey, "instagram")).orderBy(desc(ingestionRuns.startedAt)).limit(100);
  const alerts = await db.select({ id: operationalAlerts.id, integration: operationalAlerts.integration, title: operationalAlerts.title, message: operationalAlerts.message, isResolved: operationalAlerts.isResolved, createdAt: operationalAlerts.createdAt }).from(operationalAlerts).orderBy(desc(operationalAlerts.createdAt)).limit(safeSize);
  const [totals] = await db.select({ succeeded: sql<number>`sum(status = 'succeeded')`, failed: sql<number>`sum(status = 'failed')`, partial: sql<number>`sum(status = 'partial')`, imported: sql<number>`coalesce(sum(importedCount), 0)` }).from(ingestionRuns);
  const sourceRows = await db.select({ sourceKey: ingestionRuns.sourceKey, imported: sql<number>`coalesce(sum(${ingestionRuns.importedCount}), 0)`, runs: sql<number>`count(*)`, failed: sql<number>`sum(status = 'failed')` }).from(ingestionRuns).groupBy(ingestionRuns.sourceKey).orderBy(desc(sql`sum(${ingestionRuns.importedCount})`));
  const sourceMetrics = sourceRows.filter(row => row.sourceKey).map(row => ({ sourceKey: String(row.sourceKey), imported: Number(row.imported ?? 0), runs: Number(row.runs ?? 0), failed: Number(row.failed ?? 0) }));
  const criticalAlerts = alerts.filter(alert => isCriticalIngestionFailure(`${alert.title} ${alert.message}`));
  return { runs, alerts, criticalAlerts, sourceMetrics, weeklyTrend: buildWeeklyTrend(trendRuns), metaStatus: buildMetaIntegrationStatusForTest(metaRuns), totals: { succeeded: Number(totals?.succeeded ?? 0), failed: Number(totals?.failed ?? 0), partial: Number(totals?.partial ?? 0), imported: Number(totals?.imported ?? 0) } };
}

export async function reprocessIngestionSource(sourceKey: "public" | "instagram") {
  const active = await listIngestionReport(20);
  const running = active.runs.some(run => run.status === "running" && run.sourceKey === sourceKey);
  if (running) throw new Error("Essa fonte já está em processamento");
  const runId = await startIngestionRun({ routine: "manual-reprocess", sourceKey });
  try {
    const { runAgendaStepForScheduler } = await import("./agenda-routine");
    const result = await runAgendaStepForScheduler(sourceKey);
    const imported = Number((result as { result?: { imported?: number } })?.result?.imported ?? 0);
    await finishIngestionRun(runId, { status: "succeeded", importedCount: imported, details: result, routine: "manual-reprocess", sourceKey });
    return { ok: true, sourceKey, imported };
  } catch (error) {
    await finishIngestionRun(runId, { status: "failed", failedCount: 1, details: { message: error instanceof Error ? error.message : String(error) }, routine: "manual-reprocess", sourceKey });
    throw error;
  }
}

export function buildWeeklyTrendForTest(runs: Array<{ routine: string; sourceKey: string | null; status: string; importedCount: number; startedAt: Date; details: unknown }>) {
  return buildWeeklyTrend(runs);
}

export function isZeroMediaMetaRunForTest(run: { routine: string; sourceKey: string | null }, details: unknown) {
  return isZeroMediaMetaRun(run, details);
}
