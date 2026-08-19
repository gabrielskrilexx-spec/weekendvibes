import { and, desc, eq, gte, sql } from "drizzle-orm";
import { ingestionRuns, operationalAlerts, ingestionSources } from "../drizzle/schema";
import { classifyCriticalMetaReason, sendCriticalMetaAlert } from "./meta-alert-webhook";
import { getDb, recordOperationalAlert } from "./db";
import { buildFreshnessCriticalAlert, buildReconciliationDivergenceAlert } from "./operational-alert-rules";

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

export type FreshnessState = "healthy" | "delayed" | "critical" | "never";
export type IngestionTimelineEntry = { id: string; runId: string; kind: "heartbeat" | "ingestion" | "retry" | "alert"; timestamp: string; label: string; status: string; sourceKey: string | null };

export function getFreshnessState(lastSuccessAt: Date | string | null | undefined, expectedMinutes: number, now = new Date()): FreshnessState {
  if (!lastSuccessAt) return "never";
  const ageMinutes = Math.max(0, now.getTime() - new Date(lastSuccessAt).getTime()) / 60000;
  const expected = Math.max(60, expectedMinutes);
  if (ageMinutes <= expected * 1.25) return "healthy";
  if (ageMinutes <= expected * 2.5) return "delayed";
  return "critical";
}

export function buildFreshnessForTest(input: Array<{ sourceKey: string; lastSuccessAt: Date | string | null; expectedMinutes: number }>, now = new Date()) {
  return input.map(item => ({ ...item, state: getFreshnessState(item.lastSuccessAt, item.expectedMinutes, now) }));
}

export async function evaluateCriticalFreshnessAlerts(dbOverride?: Awaited<ReturnType<typeof getDb>>, now = new Date()) {
  const db = dbOverride ?? await getDb();
  if (!db) return { evaluated: 0, triggered: 0 };
  const sources = await db.select().from(ingestionSources).where(eq(ingestionSources.isEnabled, 1));
  let triggered = 0;
  for (const source of sources) {
    const state = getFreshnessState(source.lastSuccessAt, source.frequencyMinutes, now);
    const alert = buildFreshnessCriticalAlert({
      sourceKey: source.sourceKey,
      sourceName: source.name,
      state,
      lastSuccessAt: source.lastSuccessAt,
      expectedMinutes: source.frequencyMinutes,
      now,
    });
    if (!alert) continue;
    await recordOperationalAlert({ dbOverride: db, ...alert });
    triggered += 1;
  }
  return { evaluated: sources.length, triggered };
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

export function buildSourceReconciliationForTest(runs: Array<{ sourceKey: string | null; importedCount: number; details: unknown }>) {
  const grouped = new Map<string, { sourceKey: string; read: number; filtered: number; persisted: number; duplicates: number; invalidCoordinates: number; outOfBoundsCoordinates: number; runs: number }>();
  for (const run of runs) {
    const sourceKey = run.sourceKey ?? "unknown";
    const details = parseDetails(run.details);
    const current = grouped.get(sourceKey) ?? { sourceKey, read: 0, filtered: 0, persisted: 0, duplicates: 0, invalidCoordinates: 0, outOfBoundsCoordinates: 0, runs: 0 };
    current.read += findMetric(details, "read") || findMetric(details, "receivedPosts");
    current.filtered += findMetric(details, "filtered");
    current.persisted += findMetric(details, "persisted") || Number(run.importedCount ?? 0);
    current.duplicates += findMetric(details, "duplicates");
    current.invalidCoordinates += findMetric(details, "missingCoordinates");
    current.outOfBoundsCoordinates += findMetric(details, "outOfBoundsCoordinates");
    current.runs += 1;
    grouped.set(sourceKey, current);
  }
  return Array.from(grouped.values()).sort((a, b) => b.persisted - a.persisted);
}

function buildWeeklyOperationalSummary(runs: Array<{ details: unknown }>) {
  const summary = { runs: runs.length, retries: 0, fallbackList: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, inconsistentRuns: 0, degradedRuns: 0 };
  for (const run of runs) {
    const details = parseDetails(run.details);
    summary.retries += findMetric(details, "retries");
    summary.fallbackList += findMetric(details, "fallbackList");
    summary.duplicates += findMetric(details, "duplicates");
    summary.missingCoordinates += findMetric(details, "missingCoordinates");
    summary.outOfBoundsCoordinates += findMetric(details, "outOfBoundsCoordinates");
    summary.inconsistentRuns += findMetric(details, "consistent") === 0 && findMetric(details, "read") > 0 ? 1 : 0;
    summary.degradedRuns += findMetric(details, "degraded") > 0 ? 1 : 0;
  }
  return summary;
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

export type IngestionCounts = { read: number; filtered: number; persisted: number; [key: string]: number };

export function normalizeIngestionCountsForTest(input: { counts?: Partial<IngestionCounts>; details?: unknown; importedCount?: number }): IngestionCounts {
  return normalizeCounts(input);
}

function normalizeCounts(input: { counts?: Partial<IngestionCounts>; details?: unknown; importedCount?: number }): IngestionCounts {
  const details = input.details && typeof input.details === "object" ? input.details as Record<string, unknown> : {};
  const nested = details.result && typeof details.result === "object" ? details.result as Record<string, unknown> : details;
  const read = Number(input.counts?.read ?? nested.receivedPosts ?? nested.read ?? 0);
  const approved = Number(input.counts?.approved ?? nested.approvedPosts ?? nested.approved ?? 0);
  const structured = Number(input.counts?.structured ?? nested.structuredEvents ?? nested.structured ?? 0);
  const persisted = Number(input.counts?.persisted ?? nested.imported ?? input.importedCount ?? 0);
  const filtered = Number(input.counts?.filtered ?? Math.max(0, read - approved));
  return { ...input.counts, read, filtered, persisted, approved, structured };
}

export async function finishIngestionRun(id: number | undefined, input: { status: "succeeded" | "failed" | "partial"; importedCount?: number; failedCount?: number; details?: unknown; routine?: string; sourceKey?: string; durationMs?: number; httpStatus?: number; counts?: Partial<IngestionCounts> }) {
  if (!id) return;
  try {
    const db = await getDb();
    if (!db) return;
    const [existing] = await db.select({ startedAt: ingestionRuns.startedAt }).from(ingestionRuns).where(eq(ingestionRuns.id, id)).limit(1);
    const finishedAt = new Date();
    const durationMs = Math.max(0, Math.round(input.durationMs ?? (existing?.startedAt ? finishedAt.getTime() - new Date(existing.startedAt).getTime() : 0)));
    const counts = normalizeCounts(input);
    const serializedCounts = JSON.stringify(counts);
    const serializedDetails = input.details !== undefined ? JSON.stringify(input.details).slice(0, 20000) : null;
    await db.update(ingestionRuns).set({ status: input.status, importedCount: input.importedCount ?? counts.persisted, failedCount: input.failedCount ?? 0, durationMs, httpStatus: input.httpStatus ?? (input.status === "failed" ? 500 : 200), counts: serializedCounts, details: serializedDetails, finishedAt }).where(eq(ingestionRuns.id, id));
    const failureText = serializedDetails ?? "";
    const criticalMetaReason = classifyCriticalMetaReason(failureText);
    if (criticalMetaReason) {
      void sendCriticalMetaAlert({ reason: criticalMetaReason }).catch(error => console.warn("[Meta alert] Webhook delivery failed:", error instanceof Error ? error.message : "unknown"));
      await recordOperationalAlert({ dbOverride: db, integration: "meta", severity: "CRITICAL", alertType: "credential_blocked", runId: id, title: "Credenciais Meta exigem renovação", message: `A integração Meta registrou ${criticalMetaReason}. Renove manualmente o token de acesso do Instagram.` });
    }
    const reconciliation = input.details && typeof input.details === "object" ? (input.details as { reconciliation?: { consistent?: boolean; read?: number; persisted?: number; duplicates?: number; missingCoordinates?: number; outOfBoundsCoordinates?: number; issues?: string[] } }).reconciliation : undefined;
    if (reconciliation) {
      const reconciliationAlert = buildReconciliationDivergenceAlert({
        sourceKey: input.sourceKey ?? input.routine ?? "unknown",
        runId: id,
        consistent: reconciliation.consistent !== false,
        issues: reconciliation.issues ?? [],
        read: Number(reconciliation.read ?? counts.read),
        persisted: Number(reconciliation.persisted ?? counts.persisted),
        duplicates: Number(reconciliation.duplicates ?? 0),
        missingCoordinates: Number(reconciliation.missingCoordinates ?? 0),
        outOfBoundsCoordinates: Number(reconciliation.outOfBoundsCoordinates ?? 0),
      });
      if (reconciliationAlert) await recordOperationalAlert({ dbOverride: db, ...reconciliationAlert, runId: id });
    }
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
  if (!db) return { runs: [], alerts: [], criticalAlerts: [], sourceMetrics: [], freshness: [], timeline: [], reconciliationBySource: [], weeklyTrend: [], weeklySummary: { runs: 0, retries: 0, fallbackList: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, inconsistentRuns: 0, degradedRuns: 0 }, metaStatus: { status: "never" as const, lastSuccessfulSync: null, lastAttempt: null }, totals: { succeeded: 0, failed: 0, partial: 0, imported: 0 } };
  const safeSize = Math.min(Math.max(size, 1), 50);
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const runs = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(safeSize);
  const trendRuns = await db.select().from(ingestionRuns).where(gte(ingestionRuns.startedAt, cutoff)).orderBy(desc(ingestionRuns.startedAt)).limit(500);
  const metaRuns = await db.select({ status: ingestionRuns.status, startedAt: ingestionRuns.startedAt, finishedAt: ingestionRuns.finishedAt }).from(ingestionRuns).where(eq(ingestionRuns.sourceKey, "instagram")).orderBy(desc(ingestionRuns.startedAt)).limit(100);
  const alerts = await db.select({ id: operationalAlerts.id, integration: operationalAlerts.integration, severity: operationalAlerts.severity, alertType: operationalAlerts.alertType, slaMinutes: operationalAlerts.slaMinutes, runId: operationalAlerts.runId, title: operationalAlerts.title, message: operationalAlerts.message, isResolved: operationalAlerts.isResolved, createdAt: operationalAlerts.createdAt }).from(operationalAlerts).orderBy(desc(operationalAlerts.createdAt)).limit(safeSize);
  const [totals] = await db.select({ succeeded: sql<number>`sum(status = 'succeeded')`, failed: sql<number>`sum(status = 'failed')`, partial: sql<number>`sum(status = 'partial')`, imported: sql<number>`coalesce(sum(importedCount), 0)` }).from(ingestionRuns);
  const sourceRows = await db.select({ sourceKey: ingestionRuns.sourceKey, imported: sql<number>`coalesce(sum(${ingestionRuns.importedCount}), 0)`, runs: sql<number>`count(*)`, failed: sql<number>`sum(status = 'failed')` }).from(ingestionRuns).groupBy(ingestionRuns.sourceKey).orderBy(desc(sql`sum(${ingestionRuns.importedCount})`));
  const sourceConfigs = await db.select().from(ingestionSources);
  const sourceMetrics = sourceRows.filter(row => row.sourceKey).map(row => ({ sourceKey: String(row.sourceKey), imported: Number(row.imported ?? 0), runs: Number(row.runs ?? 0), failed: Number(row.failed ?? 0) }));
  const freshness = sourceConfigs.map(source => ({ sourceKey: source.sourceKey, name: source.name, kind: source.kind, lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null, expectedMinutes: source.frequencyMinutes, state: getFreshnessState(source.lastSuccessAt, source.frequencyMinutes) }));
  const feedLastSuccess = trendRuns.filter(run => run.status === "succeeded").sort((a, b) => new Date(b.finishedAt ?? b.startedAt).getTime() - new Date(a.finishedAt ?? a.startedAt).getTime())[0];
  freshness.unshift({ sourceKey: "feed", name: "Feed geral", kind: "public", lastSuccessAt: feedLastSuccess ? new Date(feedLastSuccess.finishedAt ?? feedLastSuccess.startedAt).toISOString() : null, expectedMinutes: 1440, state: getFreshnessState(feedLastSuccess?.finishedAt ?? feedLastSuccess?.startedAt, 1440) });
  const timeline: IngestionTimelineEntry[] = runs.flatMap(run => { const details = parseDetails(run.details); const retryCount = findMetric(details, "retries"); const base: IngestionTimelineEntry[] = [{ id: `run-${run.id}-start`, runId: String(run.id), kind: "heartbeat", timestamp: new Date(run.startedAt).toISOString(), label: `${run.routine} iniciado`, status: run.status, sourceKey: run.sourceKey }]; const finish: IngestionTimelineEntry[] = run.finishedAt ? [{ id: `run-${run.id}-finish`, runId: String(run.id), kind: "ingestion", timestamp: new Date(run.finishedAt).toISOString(), label: `${run.routine} ${run.status}`, status: run.status, sourceKey: run.sourceKey }] : []; const retries: IngestionTimelineEntry[] = retryCount > 0 ? [{ id: `run-${run.id}-retry`, runId: String(run.id), kind: "retry", timestamp: new Date(run.finishedAt ?? run.startedAt).toISOString(), label: `${retryCount} retry(s) registrado(s)`, status: run.status, sourceKey: run.sourceKey }] : []; return [...base, ...retries, ...finish]; });
  timeline.push(...alerts.map(alert => ({ id: `alert-${alert.id}`, runId: alert.runId ?? "—", kind: "alert" as const, timestamp: new Date(alert.createdAt).toISOString(), label: alert.title, status: alert.severity, sourceKey: alert.integration })));
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  timeline.splice(80);
  const criticalAlerts = alerts.filter(alert => alert.severity === "CRITICAL" || isCriticalIngestionFailure(`${alert.title} ${alert.message}`));
  return { runs, alerts, criticalAlerts, sourceMetrics, freshness, timeline, reconciliationBySource: buildSourceReconciliationForTest(trendRuns), weeklyTrend: buildWeeklyTrend(trendRuns), weeklySummary: buildWeeklyOperationalSummary(trendRuns), metaStatus: buildMetaIntegrationStatusForTest(metaRuns), totals: { succeeded: Number(totals?.succeeded ?? 0), failed: Number(totals?.failed ?? 0), partial: Number(totals?.partial ?? 0), imported: Number(totals?.imported ?? 0) } };
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
