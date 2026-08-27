import { and, desc, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { isGracefullyDegradedMetaFailure } from "./instagram-pipeline";
import {
  ingestionRuns,
  operationalAlerts,
  ingestionSources,
} from "../drizzle/schema";
import {
  classifyCriticalMetaReason,
  sendCriticalMetaAlert,
} from "./meta-alert-webhook";
import { handleIngestionFailureAlert, notifyConsecutiveFailureWebhook, notifyPerformanceDegradationWebhook } from "./ingestion-failure-alerts";
import { getDb, recordOperationalAlert } from "./db";
import {
  buildFreshnessCriticalAlert,
  buildReconciliationDivergenceAlert,
  buildStructuredPersistenceMismatchAlert,
} from "./operational-alert-rules";
import {
  InstagramIntegrationFailure,
  getMetaFailureStatus,
} from "./instagram-pipeline";
import { listHeartbeatJobs } from "./_core/heartbeat";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings";

export function isCriticalIngestionFailure(details: unknown) {
  const text =
    typeof details === "string" ? details : JSON.stringify(details ?? "");
  return /timeout|http\s*5\d{2}|status\s*5\d{2}|\b5\d{2}\b|http\s*200[^\n]*(zero|0)[^\n]*(mídia|media)/i.test(
    text
  );
}

function parseDetails(details: unknown): unknown {
  if (typeof details !== "string") return details;
  try {
    return JSON.parse(details);
  } catch {
    return details;
  }
}

function isSandboxRestrictedDetails(details: unknown) {
  const text = typeof details === "string" ? details : JSON.stringify(details ?? "");
  return /sandbox_restricted|previewmock/i.test(text);
}

function safeReportError(value: unknown) {
  return String(value ?? "Falha não especificada")
    .replace(/https?:\/\/[^\s]+/gi, "fonte pública")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function buildAutomationStatusSnapshot(
  runs: Array<{
    id: number;
    routine: string;
    sourceKey: string | null;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    details: unknown;
  }>
) {
  const latest = [...runs].sort(
    (a, b) =>
      new Date(b.finishedAt ?? b.startedAt).getTime() -
      new Date(a.finishedAt ?? a.startedAt).getTime()
  )[0];
  if (!latest)
    return {
      lastExecutionAt: null,
      routine: null,
      runId: null,
      status: "never",
      sources: [],
      errors: [],
    };
  const details = parseDetails(latest.details);
  const root =
    details && typeof details === "object"
      ? (details as Record<string, unknown>)
      : {};
  const summary =
    root.automationSummary && typeof root.automationSummary === "object"
      ? (root.automationSummary as Record<string, unknown>)
      : root;
  const rawSources = Array.isArray(summary.sources)
    ? summary.sources
    : [
        {
          sourceKey: latest.sourceKey ?? latest.routine,
          read: root.read,
          added: root.added ?? root.persisted ?? root.imported,
          updated: root.updated,
          ignored: root.ignored ?? root.filtered,
          errors: root.errors,
        },
      ];
  const sources = rawSources
    .filter(item => item && typeof item === "object")
    .slice(0, 20)
    .map(item => {
      const source = item as Record<string, unknown>;
      const errors = Array.isArray(source.errors)
        ? source.errors
            .slice(0, 10)
            .map(error => ({
              status:
                error && typeof error === "object"
                  ? Number((error as Record<string, unknown>).status ?? 0) ||
                    null
                  : null,
              message: safeReportError(
                error && typeof error === "object"
                  ? (error as Record<string, unknown>).message
                  : error
              ),
            }))
        : [];
      return {
        sourceKey: String(
          source.sourceKey ?? latest.sourceKey ?? latest.routine
        ),
        read: Number(source.read ?? 0) || 0,
        added: Number(source.added ?? 0) || 0,
        updated: Number(source.updated ?? 0) || 0,
        ignored: Number(source.ignored ?? 0) || 0,
        errors,
      };
    });
  const errors = Array.isArray(summary.errors)
    ? summary.errors.slice(0, 20).map(error => {
        const item =
          error && typeof error === "object"
            ? (error as Record<string, unknown>)
            : {};
        return {
          sourceKey: String(
            item.sourceKey ?? latest.sourceKey ?? latest.routine
          ),
          status: Number(item.status ?? 0) || null,
          message: safeReportError(item.message),
        };
      })
    : sources.flatMap(source =>
        source.errors.map(error => ({ sourceKey: source.sourceKey, ...error }))
      );
  const status = ["succeeded", "partial", "failed", "running"].includes(
    latest.status
  )
    ? latest.status
    : "failed";
  return {
    lastExecutionAt: new Date(
      latest.finishedAt ?? latest.startedAt
    ).toISOString(),
    routine: latest.routine,
    runId: Number(latest.id),
    status,
    sources,
    errors: errors.slice(0, 20),
  };
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

function findRecord(details: unknown, key: string): Record<string, number> {
  if (!details || typeof details !== "object") return {};
  const record = details as Record<string, unknown>;
  const direct = record[key];
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return Object.fromEntries(
      Object.entries(direct)
        .filter(([, value]) => typeof value === "number")
        .map(([name, value]) => [name, Number(value)])
    );
  }
  for (const value of Object.values(record)) {
    const found = findRecord(value, key);
    if (Object.keys(found).length > 0) return found;
  }
  return {};
}

export type FreshnessState = "healthy" | "delayed" | "critical" | "never";
export type IngestionTimelineEntry = {
  id: string;
  runId: string;
  kind: "heartbeat" | "ingestion" | "retry" | "alert";
  timestamp: string;
  label: string;
  status: string;
  sourceKey: string | null;
};
export type DailyIngestionMetric = {
  date: string;
  label: string;
  runs: number;
  succeeded: number;
  failed: number;
  partial: number;
  receivedPosts: number;
  approvedPosts: number;
  structuredEvents: number;
  imported: number;
  persisted: number;
  filtered: number;
  rejectedPastEvents: number;
  rejectedAllowlist: number;
  zeroMediaRuns: number;
};

export function getFreshnessState(
  lastSuccessAt: Date | string | null | undefined,
  expectedMinutes: number,
  now = new Date()
): FreshnessState {
  if (!lastSuccessAt) return "never";
  const ageMinutes =
    Math.max(0, now.getTime() - new Date(lastSuccessAt).getTime()) / 60000;
  const expected = Math.max(60, expectedMinutes);
  if (ageMinutes <= expected * 1.25) return "healthy";
  if (ageMinutes <= expected * 2.5) return "delayed";
  return "critical";
}

export function buildFreshnessForTest(
  input: Array<{
    sourceKey: string;
    lastSuccessAt: Date | string | null;
    expectedMinutes: number;
  }>,
  now = new Date()
) {
  return input.map(item => ({
    ...item,
    state: getFreshnessState(item.lastSuccessAt, item.expectedMinutes, now),
  }));
}

export async function evaluateCriticalFreshnessAlerts(
  dbOverride?: Awaited<ReturnType<typeof getDb>>,
  now = new Date()
) {
  const db = dbOverride ?? (await getDb());
  if (!db) return { evaluated: 0, triggered: 0 };
  const sources = await db
    .select()
    .from(ingestionSources)
    .where(eq(ingestionSources.isEnabled, 1));
  let triggered = 0;
  for (const source of sources) {
    const state = getFreshnessState(
      source.lastSuccessAt,
      source.frequencyMinutes,
      now
    );
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

function isZeroMediaMetaRun(
  run: { routine: string; sourceKey: string | null },
  details: unknown
) {
  return isInstagramRun(run) && findMetric(details, "receivedPosts") === 0;
}

function saoPauloDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function buildDailyIngestionMetricsForTest(
  runs: Array<{
    routine: string;
    sourceKey: string | null;
    status: string;
    importedCount: number;
    startedAt: Date;
    details: unknown;
  }>,
  today = new Date()
): DailyIngestionMetric[] {
  const buckets = new Map<string, DailyIngestionMetric>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    const key = saoPauloDayKey(date);
    buckets.set(key, {
      date: key,
      label: new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
      }).format(date),
      runs: 0,
      succeeded: 0,
      failed: 0,
      partial: 0,
      receivedPosts: 0,
      approvedPosts: 0,
      structuredEvents: 0,
      imported: 0,
      persisted: 0,
      filtered: 0,
      rejectedPastEvents: 0,
      rejectedAllowlist: 0,
      zeroMediaRuns: 0,
    });
  }
  for (const run of runs) {
    const bucket = buckets.get(saoPauloDayKey(new Date(run.startedAt)));
    if (!bucket) continue;
    const details = parseDetails(run.details);
    const rejection = rejectionMetrics(details);
    bucket.runs += 1;
    bucket.succeeded += run.status === "succeeded" ? 1 : 0;
    bucket.failed += run.status === "failed" ? 1 : 0;
    bucket.partial += run.status === "partial" ? 1 : 0;
    bucket.receivedPosts +=
      findMetric(details, "receivedPosts") || findMetric(details, "read");
    bucket.approvedPosts += findMetric(details, "approvedPosts");
    bucket.filtered +=
      findMetric(details, "filtered") ||
      Math.max(0, bucket.receivedPosts - bucket.approvedPosts);
    bucket.structuredEvents +=
      findMetric(details, "structuredEvents") ||
      findMetric(details, "structured");
    bucket.imported += Number(run.importedCount ?? 0);
    bucket.persisted +=
      findMetric(details, "persisted") || Number(run.importedCount ?? 0);
    bucket.rejectedPastEvents += rejection.rejectedPastEvents;
    bucket.rejectedAllowlist += rejection.rejectedAllowlist;
    bucket.zeroMediaRuns += isZeroMediaMetaRun(run, details) ? 1 : 0;
  }
  return Array.from(buckets.values());
}

function buildWeeklyTrend(
  runs: Array<{
    routine: string;
    sourceKey: string | null;
    status: string;
    importedCount: number;
    startedAt: Date;
    details: unknown;
  }>
) {
  const today = new Date();
  const buckets = new Map<string, DailyIngestionMetric>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    const key = saoPauloDayKey(date);
    buckets.set(key, {
      date: key,
      label: new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
      }).format(date),
      runs: 0,
      succeeded: 0,
      failed: 0,
      partial: 0,
      receivedPosts: 0,
      approvedPosts: 0,
      structuredEvents: 0,
      imported: 0,
      persisted: 0,
      filtered: 0,
      rejectedPastEvents: 0,
      rejectedAllowlist: 0,
      zeroMediaRuns: 0,
    });
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
    bucket.persisted +=
      findMetric(details, "persisted") || Number(run.importedCount ?? 0);
    bucket.filtered +=
      findMetric(details, "filtered") ||
      Math.max(
        0,
        findMetric(details, "receivedPosts") -
          findMetric(details, "approvedPosts")
      );
    const rejection = rejectionMetrics(details);
    bucket.rejectedPastEvents += rejection.rejectedPastEvents;
    bucket.rejectedAllowlist += rejection.rejectedAllowlist;
    bucket.receivedPosts += findMetric(details, "receivedPosts");
    bucket.approvedPosts += findMetric(details, "approvedPosts");
    bucket.structuredEvents += findMetric(details, "structuredEvents");
    bucket.zeroMediaRuns += isZeroMediaMetaRun(run, details) ? 1 : 0;
  }
  return Array.from(buckets.values());
}

export type SourceTelemetry = {
  sourceKey: string;
  runs: number;
  successes: number;
  successRate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  simulatedExecutions: number;
  errors: { category: "anti_bot" | "proxy" | "timeout_dns" | "sandbox" | "other"; count: number }[];
};

export type SourceTelemetryHistoryPoint = {
  date: string;
  label: string;
  sourceKey: string;
  runs: number;
  successes: number;
  successRate: number;
  simulatedExecutions: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
};

export function buildSourceTelemetryHistoryForTest(runs: Array<{ sourceKey: string | null; status: string; startedAt: string | Date; finishedAt?: string | Date | null; durationMs?: number | null; details?: unknown }>): SourceTelemetryHistoryPoint[] {
  const grouped = new Map<string, { date: string; sourceKey: string; runs: number; successes: number; simulatedExecutions: number; latencyTotal: number; latencyCount: number; latencies: number[] }>();
  for (const run of runs) {
    const sourceKey = run.sourceKey ?? "unknown";
    const startedAt = new Date(run.startedAt);
    if (Number.isNaN(startedAt.getTime())) continue;
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(startedAt);
    const key = `${date}:${sourceKey}`;
    const current = grouped.get(key) ?? { date, sourceKey, runs: 0, successes: 0, simulatedExecutions: 0, latencyTotal: 0, latencyCount: 0, latencies: [] };
    const isSandbox = /sandbox_restricted|previewmock/i.test(JSON.stringify(run.details ?? ""));
    current.runs += 1;
    if (isSandbox) current.simulatedExecutions += 1;
    else if (run.status === "succeeded") current.successes += 1;
    const measured = Number(run.durationMs ?? (run.finishedAt ? new Date(run.finishedAt).getTime() - startedAt.getTime() : 0));
    if (Number.isFinite(measured) && measured > 0) { current.latencyTotal += measured; current.latencyCount += 1; current.latencies.push(measured); }
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date) || a.sourceKey.localeCompare(b.sourceKey)).map(item => ({ date: item.date, label: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(`${item.date}T12:00:00-03:00`)), sourceKey: item.sourceKey, runs: item.runs, successes: item.successes, successRate: item.runs - item.simulatedExecutions > 0 ? Number((item.successes / (item.runs - item.simulatedExecutions)).toFixed(4)) : 0, simulatedExecutions: item.simulatedExecutions, averageLatencyMs: item.latencyCount ? Math.round(item.latencyTotal / item.latencyCount) : 0, p95LatencyMs: item.latencies.length ? item.latencies.sort((a, b) => a - b)[Math.min(item.latencies.length - 1, Math.ceil(item.latencies.length * 0.95) - 1)] : 0 }));
}
type SourceErrorCategory = SourceTelemetry["errors"][number]["category"];

export function findConsecutiveP95PerformanceAlertsForTest(runs: Array<{ sourceKey: string | null; status: string; startedAt: string | Date; durationMs?: number | null }>, thresholdMs: number | Map<string, number> = 3000) {
  const bySource = new Map<string, Array<{ startedAt: number; durationMs: number }>>();
  for (const run of runs) { const durationMs = Number(run.durationMs ?? 0); const startedAt = new Date(run.startedAt).getTime(); if (!run.sourceKey || !Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(startedAt)) continue; const list = bySource.get(run.sourceKey) ?? []; list.push({ startedAt, durationMs }); bySource.set(run.sourceKey, list); }
  return Array.from(bySource.entries()).flatMap(([sourceKey, list]) => { const sourceThreshold = typeof thresholdMs === "number" ? thresholdMs : thresholdMs.get(sourceKey) ?? 3000; const sortedRuns = list.sort((a, b) => b.startedAt - a.startedAt); if (sortedRuns.length < 2 || sortedRuns[0].durationMs <= sourceThreshold || sortedRuns[1].durationMs <= sourceThreshold) return []; const samples = sortedRuns.slice(0, 20).map(item => item.durationMs).sort((a, b) => a - b); const p95LatencyMs = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)]; return [{ sourceKey, p95LatencyMs, thresholdMs: sourceThreshold, consecutiveRuns: 2 }]; });
}


export function buildSourceTelemetryForTest(runs: Array<{ sourceKey: string | null; status: string; durationMs?: number | null; httpStatus?: number | null; details: unknown }>): SourceTelemetry[] {
  const grouped = new Map<string, SourceTelemetry & { latencyTotal: number; latencyCount: number; latencies: number[]; categories: Record<string, number>; realRuns: number }>();
  for (const run of runs) {
    const sourceKey = run.sourceKey ?? "unknown";
    const current = grouped.get(sourceKey) ?? { sourceKey, runs: 0, successes: 0, successRate: 0, averageLatencyMs: 0, p95LatencyMs: 0, simulatedExecutions: 0, errors: [], latencyTotal: 0, latencyCount: 0, latencies: [], categories: {}, realRuns: 0 };
    const isSandbox = /sandbox_restricted|previewmock/i.test(JSON.stringify(run.details ?? ""));
    current.runs += 1;
    if (isSandbox) current.simulatedExecutions += 1;
    else { current.realRuns += 1; if (run.status === "succeeded") current.successes += 1; }
    const duration = Number(run.durationMs ?? 0);
    if (Number.isFinite(duration) && duration > 0) { current.latencyTotal += duration; current.latencyCount += 1; current.latencies.push(duration); }
    const text = JSON.stringify(run.details ?? "").toLowerCase();
    const status = Number(run.httpStatus ?? 0);
    let category: SourceErrorCategory | "none" = "none";
    if (text.includes("sandbox_restricted") || text.includes("previewmock")) category = "sandbox";
    else if ([403, 429].includes(status) || /anti.?bot|cloudflare|challenge|waf|forbidden/.test(text)) category = "anti_bot";
    else if ([502, 503, 504].includes(status) || /bad gateway|proxy|gateway|server error/.test(text)) category = "proxy";
    else if (/timeout|timed out|enotfound|eai_again|econnrefused|network/.test(text)) category = "timeout_dns";
    else if (run.status === "failed") category = "other";
    if (category !== "none") current.categories[category] = (current.categories[category] ?? 0) + 1;
    grouped.set(sourceKey, current);
  }
  return Array.from(grouped.values()).map(item => { const sorted = [...item.latencies].sort((a, b) => a - b); const p95LatencyMs = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : 0; return { sourceKey: item.sourceKey, runs: item.runs, successes: item.successes, successRate: item.realRuns ? Number((item.successes / item.realRuns).toFixed(4)) : 0, simulatedExecutions: item.simulatedExecutions, averageLatencyMs: item.latencyCount ? Math.round(item.latencyTotal / item.latencyCount) : 0, p95LatencyMs, errors: Object.entries(item.categories).map(([category, count]) => ({ category: category as SourceErrorCategory, count })) }; });
}

export function buildSourceReconciliationForTest(
  runs: Array<{
    sourceKey: string | null;
    importedCount: number;
    details: unknown;
  }>
) {
  const grouped = new Map<
    string,
    {
      sourceKey: string;
      read: number;
      filtered: number;
      persisted: number;
      duplicates: number;
      invalidCoordinates: number;
      outOfBoundsCoordinates: number;
      runs: number;
    }
  >();
  for (const run of runs) {
    const sourceKey = run.sourceKey ?? "unknown";
    const details = parseDetails(run.details);
    const current = grouped.get(sourceKey) ?? {
      sourceKey,
      read: 0,
      filtered: 0,
      persisted: 0,
      duplicates: 0,
      invalidCoordinates: 0,
      outOfBoundsCoordinates: 0,
      runs: 0,
    };
    current.read +=
      findMetric(details, "read") || findMetric(details, "receivedPosts");
    current.filtered += findMetric(details, "filtered");
    current.persisted +=
      findMetric(details, "persisted") || Number(run.importedCount ?? 0);
    current.duplicates += findMetric(details, "duplicates");
    current.invalidCoordinates += findMetric(details, "missingCoordinates");
    current.outOfBoundsCoordinates += findMetric(
      details,
      "outOfBoundsCoordinates"
    );
    current.runs += 1;
    grouped.set(sourceKey, current);
  }
  return Array.from(grouped.values()).sort((a, b) => b.persisted - a.persisted);
}

export function serializeIngestionRunForTest(
  run: typeof ingestionRuns.$inferSelect
) {
  return {
    id: Number(run.id),
    routine: String(run.routine ?? ""),
    sourceKey: run.sourceKey == null ? null : String(run.sourceKey),
    status: String(run.status),
    importedCount: Number(run.importedCount ?? 0),
    failedCount: Number(run.failedCount ?? 0),
    durationMs: run.durationMs == null ? null : Number(run.durationMs),
    httpStatus: run.httpStatus == null ? null : Number(run.httpStatus),
    counts: run.counts == null ? null : String(run.counts),
    details: run.details == null ? null : String(run.details),
    startedAt: new Date(run.startedAt).toISOString(),
    finishedAt:
      run.finishedAt == null ? null : new Date(run.finishedAt).toISOString(),
  };
}

export function serializeOperationalAlertForTest(alert: {
  id: number;
  integration: string;
  severity: string;
  alertType: string | null;
  slaMinutes: number | null;
  runId: string | null;
  title: string;
  message: string;
  isResolved: number;
  createdAt: Date;
}) {
  return {
    id: Number(alert.id),
    integration: String(alert.integration ?? ""),
    severity: String(alert.severity),
    alertType: alert.alertType == null ? null : String(alert.alertType),
    slaMinutes: alert.slaMinutes == null ? null : Number(alert.slaMinutes),
    runId: alert.runId == null ? null : String(alert.runId),
    title: String(alert.title ?? ""),
    message: String(alert.message ?? ""),
    isResolved: Number(alert.isResolved ?? 0),
    createdAt: new Date(alert.createdAt).toISOString(),
  };
}

function buildWeeklyOperationalSummary(runs: Array<{ details: unknown }>) {
  const summary = {
    runs: runs.length,
    retries: 0,
    fallbackList: 0,
    duplicates: 0,
    missingCoordinates: 0,
    outOfBoundsCoordinates: 0,
    inconsistentRuns: 0,
    degradedRuns: 0,
    rejectedEvents: 0,
    rejectedPastEvents: 0,
    rejectedOtherReasons: 0,
  };
  for (const run of runs) {
    const details = parseDetails(run.details);
    summary.retries += findMetric(details, "retries");
    summary.fallbackList += findMetric(details, "fallbackList");
    summary.duplicates += findMetric(details, "duplicates");
    summary.missingCoordinates += findMetric(details, "missingCoordinates");
    summary.outOfBoundsCoordinates += findMetric(
      details,
      "outOfBoundsCoordinates"
    );
    summary.inconsistentRuns +=
      findMetric(details, "consistent") === 0 && findMetric(details, "read") > 0
        ? 1
        : 0;
    summary.degradedRuns += findMetric(details, "degraded") > 0 ? 1 : 0;
    const rejection = rejectionMetrics(details);
    summary.rejectedEvents += rejection.rejectedEvents;
    summary.rejectedPastEvents += rejection.rejectedPastEvents;
    summary.rejectedOtherReasons += rejection.rejectedOtherReasons;
  }
  return summary;
}

export async function startIngestionRun(input: {
  routine: string;
  sourceKey?: string;
}) {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db
      .insert(ingestionRuns)
      .values({
        routine: input.routine.slice(0, 64),
        sourceKey: input.sourceKey?.slice(0, 255),
        status: "running",
      });
    return Number(result[0].insertId);
  } catch (error) {
    console.warn("[Ingestion reports] Could not start run record:", error);
    return undefined;
  }
}

export type IngestionCounts = {
  read: number;
  filtered: number;
  persisted: number;
  rejectedEvents: number;
  rejectedPastEvents: number;
  rejectedOtherReasons: number;
  [key: string]: number;
};

export function getPastEventRejectionThreshold() {
  const raw = Number(
    process.env.INGESTION_PAST_DATE_REJECTION_THRESHOLD ?? "0.5"
  );
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.5;
}

function rejectionMetrics(details: unknown) {
  const reasons = findRecord(details, "rejectionReasons");
  const rejectedPastEvents = Math.max(0, Number(reasons.past_event ?? 0));
  const rejectedEvents = Math.max(
    rejectedPastEvents,
    Object.values(reasons).reduce(
      (sum, value) => sum + Math.max(0, Number(value) || 0),
      0
    )
  );
  const rejectedAllowlist = Math.max(
    0,
    findMetric(details, "outsideTargetVenue") ||
      findMetric(details, "outside_target_venue")
  );
  return {
    rejectedEvents,
    rejectedPastEvents,
    rejectedAllowlist,
    rejectedOtherReasons: Math.max(0, rejectedEvents - rejectedPastEvents),
  };
}

export function normalizeIngestionCountsForTest(input: {
  counts?: Partial<IngestionCounts>;
  details?: unknown;
  importedCount?: number;
}): IngestionCounts {
  return normalizeCounts(input);
}

function normalizeCounts(input: {
  counts?: Partial<IngestionCounts>;
  details?: unknown;
  importedCount?: number;
}): IngestionCounts {
  const details =
    input.details && typeof input.details === "object"
      ? (input.details as Record<string, unknown>)
      : {};
  const nested =
    details.result && typeof details.result === "object"
      ? (details.result as Record<string, unknown>)
      : details;
  const read = Number(
    input.counts?.read ?? nested.receivedPosts ?? nested.read ?? 0
  );
  const approved = Number(
    input.counts?.approved ?? nested.approvedPosts ?? nested.approved ?? 0
  );
  const structured = Number(
    input.counts?.structured ??
      nested.structuredEvents ??
      nested.structured ??
      0
  );
  const persisted = Number(
    input.counts?.persisted ?? nested.imported ?? input.importedCount ?? 0
  );
  const filtered = Number(
    input.counts?.filtered ?? Math.max(0, read - approved)
  );
  const rejection = rejectionMetrics(input.details);
  return {
    ...input.counts,
    read,
    filtered,
    persisted,
    approved,
    structured,
    rejectedEvents: Number(
      input.counts?.rejectedEvents ?? rejection.rejectedEvents
    ),
    rejectedPastEvents: Number(
      input.counts?.rejectedPastEvents ?? rejection.rejectedPastEvents
    ),
    rejectedOtherReasons: Number(
      input.counts?.rejectedOtherReasons ?? rejection.rejectedOtherReasons
    ),
  };
}

export async function finishIngestionRun(
  id: number | undefined,
  input: {
    status: "succeeded" | "failed" | "partial";
    importedCount?: number;
    failedCount?: number;
    details?: unknown;
    routine?: string;
    sourceKey?: string;
    durationMs?: number;
    httpStatus?: number;
    counts?: Partial<IngestionCounts>;
  }
) {
  if (!id) return;
  try {
    const db = await getDb();
    if (!db) return;
    const [existing] = await db
      .select({ startedAt: ingestionRuns.startedAt })
      .from(ingestionRuns)
      .where(eq(ingestionRuns.id, id))
      .limit(1);
    const finishedAt = new Date();
    const durationMs = Math.max(
      0,
      Math.round(
        input.durationMs ??
          (existing?.startedAt
            ? finishedAt.getTime() - new Date(existing.startedAt).getTime()
            : 0)
      )
    );
    const counts = normalizeCounts(input);
    const serializedCounts = JSON.stringify(counts);
    const serializedDetails =
      input.details !== undefined
        ? JSON.stringify(input.details).slice(0, 20000)
        : null;
    await db
      .update(ingestionRuns)
      .set({
        status: input.status,
        importedCount: input.importedCount ?? counts.persisted,
        failedCount: input.failedCount ?? 0,
        durationMs,
        httpStatus: input.httpStatus ?? (input.status === "failed" ? 500 : 200),
        counts: serializedCounts,
        details: serializedDetails,
        finishedAt,
      })
      .where(eq(ingestionRuns.id, id));
    const failureText = serializedDetails ?? "";
    const criticalMetaReason = classifyCriticalMetaReason(failureText);
    if (criticalMetaReason) {
      void sendCriticalMetaAlert({ reason: criticalMetaReason }).catch(error =>
        console.warn(
          "[Meta alert] Webhook delivery failed:",
          error instanceof Error ? error.message : "unknown"
        )
      );
      await recordOperationalAlert({
        dbOverride: db,
        integration: "meta",
        severity: "CRITICAL",
        alertType: "credential_blocked",
        runId: id,
        title: "Credenciais Meta exigem renovação",
        message: `A integração Meta registrou ${criticalMetaReason}. Renove manualmente o token de acesso do Instagram.`,
      });
    }
    const reconciliation =
      input.details && typeof input.details === "object"
        ? (
            input.details as {
              reconciliation?: {
                consistent?: boolean;
                read?: number;
                persisted?: number;
                duplicates?: number;
                missingCoordinates?: number;
                outOfBoundsCoordinates?: number;
                issues?: string[];
              };
            }
          ).reconciliation
        : undefined;
    const structuredPersistenceAlert = buildStructuredPersistenceMismatchAlert({
      sourceKey: input.sourceKey ?? input.routine ?? "unknown",
      runId: id,
      structured: counts.structured,
      persisted: counts.persisted,
      rejectionReasons: findRecord(input.details, "rejectionReasons"),
    });
    if (structuredPersistenceAlert) {
      await recordOperationalAlert({
        dbOverride: db,
        ...structuredPersistenceAlert,
        runId: id,
      });
    }
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
        outOfBoundsCoordinates: Number(
          reconciliation.outOfBoundsCoordinates ?? 0
        ),
      });
      if (reconciliationAlert)
        await recordOperationalAlert({
          dbOverride: db,
          ...reconciliationAlert,
          runId: id,
        });
    }
    if (input.status === "failed" && isCriticalIngestionFailure(failureText)) {
      await recordOperationalAlert({
        dbOverride: db,
        integration: "pipeline",
        title: "Falha crítica na ingestão",
        message: `A rotina ${id} registrou timeout ou erro HTTP 5xx: ${failureText}`,
      });
    }
    const runShape = {
      routine: input.routine ?? "",
      sourceKey: input.sourceKey ?? null,
    };
    if (
      input.status === "succeeded" &&
      isZeroMediaMetaRun(runShape, input.details)
    ) {
      await recordOperationalAlert({
        dbOverride: db,
        integration: "meta",
        title: "Meta respondeu HTTP 200 sem mídias",
        message:
          "A API oficial da Meta respondeu HTTP 200, mas não retornou mídias para os perfis monitorados. Verifique permissões do Business Discovery, vínculo Página–Instagram e validade do token.",
      });
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

export function buildMetaIntegrationStatusForTest(
  runs: Array<{ status: string; startedAt: Date; finishedAt?: Date | null }>
): MetaIntegrationStatus {
  const ordered = [...runs].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
  );
  const latest = ordered[0];
  const successful = ordered.find(run => run.status === "succeeded");
  const status =
    latest?.status === "succeeded"
      ? "active"
      : latest?.status === "failed"
        ? "failed"
        : latest
          ? "degraded"
          : "never";
  return {
    status,
    lastSuccessfulSync: successful
      ? (successful.finishedAt ?? successful.startedAt).toISOString()
      : null,
    lastAttempt: latest ? latest.startedAt.toISOString() : null,
  };
}

export function normalizeReportForTransport<T>(payload: T): T {
  return JSON.parse(
    JSON.stringify(payload, (_key, value: unknown) => {
      if (typeof value === "bigint") return Number(value);
      if (value instanceof Error)
        return { name: value.name, message: value.message.slice(0, 240) };
      return value;
    })
  ) as T;
}

export type RoutineScheduleStatus = {
  routine: "instagram-agenda" | "public-agenda";
  label: string;
  sourceKey: "instagram" | "public";
  enabled: boolean;
  cronExpression: string | null;
  timezone: string | null;
  nextExecutionAt: string | null;
  lastExecutionAt: string | null;
  lastAttemptStatus: string | null;
  lastRunId: number | null;
  metadataSource: "heartbeat" | "heartbeat-derived" | "unavailable";
};

export async function listRoutineScheduleStatus(): Promise<
  RoutineScheduleStatus[]
> {
  const definitions = [
    {
      routine: "instagram-agenda" as const,
      sourceKey: "instagram" as const,
      label: "Instagram — Agenda da Semana",
      path: "/api/scheduled/ingest-instagram",
    },
    {
      routine: "public-agenda" as const,
      sourceKey: "public" as const,
      label: "Fontes públicas — Agenda",
      path: "/api/scheduled/ingest-events",
    },
  ];
  const db = await getDb();
  const latestRuns = db
    ? await db
        .select({
          id: ingestionRuns.id,
          routine: ingestionRuns.routine,
          sourceKey: ingestionRuns.sourceKey,
          status: ingestionRuns.status,
          startedAt: ingestionRuns.startedAt,
          finishedAt: ingestionRuns.finishedAt,
        })
        .from(ingestionRuns)
        .orderBy(desc(ingestionRuns.startedAt))
        .limit(100)
    : [];
  let jobs: Awaited<ReturnType<typeof listHeartbeatJobs>>["jobs"] = [];
  let heartbeatAvailable = true;
  try {
    jobs = (await listHeartbeatJobs("", { page: 1, pageSize: 100 })).jobs;
  } catch (error) {
    heartbeatAvailable = false;
    console.warn(
      "[Ingestion reports] Could not load Heartbeat schedules:",
      error instanceof Error ? error.message.slice(0, 180) : "unknown error"
    );
  }
  return definitions.map(definition => {
    const job = jobs.find(
      item =>
        item.callbackPath === definition.path ||
        item.name.toLowerCase().includes(definition.routine)
    );
    const run = latestRuns.find(
      item =>
        item.sourceKey === definition.sourceKey ||
        item.routine === definition.routine
    );
    return {
      routine: definition.routine,
      label: definition.label,
      sourceKey: definition.sourceKey,
      enabled: job ? job.isEnable : false,
      cronExpression: job?.cronExpression ?? null,
      timezone: job?.timezone ?? "UTC",
      nextExecutionAt: job?.nextExecutionAt ?? null,
      lastExecutionAt: run
        ? new Date(run.finishedAt ?? run.startedAt).toISOString()
        : (job?.lastExecutedAt ?? null),
      lastAttemptStatus: run?.status ?? job?.status ?? null,
      lastRunId: run?.id ?? null,
      metadataSource: job
        ? "heartbeat"
        : heartbeatAvailable
          ? "heartbeat-derived"
          : "unavailable",
    };
  });
}

export type IngestionReportFilters = {
  periodDays?: 7 | 15 | 30 | 90 | "all";
  routine?: "instagram-agenda" | "public-agenda" | "manual-reprocess";
  status?: "running" | "succeeded" | "partial" | "failed";
  trigger?: "manual" | "scheduled";
  runId?: number;
    sourceKey?: string;
  executionKind?: "all" | "real" | "simulated";
};
function isSandboxExecution(details: unknown) {
  return /sandbox_restricted|previewmock/i.test(JSON.stringify(parseDetails(details) ?? ""));
}
function runTrigger(details: unknown): "manual" | "scheduled" {
  const parsed = parseDetails(details);
  return parsed &&
    typeof parsed === "object" &&
    (parsed as Record<string, unknown>).trigger === "manual"
    ? "manual"
    : "scheduled";
}

export function findConsecutiveFailureAlertsForTest(
  runs: Array<{
    id: number;
    routine: string;
    sourceKey: string | null;
    status: string;
    startedAt: Date | string;
    details: unknown;
  }>,
  minimum = 2
) {
  const ordered = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const byRoutine = new Map<string, typeof ordered>();
  for (const run of ordered) {
    const key = run.routine || run.sourceKey || "unknown";
    const list = byRoutine.get(key) ?? [];
    list.push(run);
    byRoutine.set(key, list);
  }
  return Array.from(byRoutine.entries()).flatMap(([routine, items]) => {
    const failed = items.filter(
      item =>
        item.status === "failed" &&
        (() => {
          const details = parseDetails(item.details);
          return (
            details &&
            typeof details === "object" &&
            ((details as Record<string, unknown>).retryExhausted === true ||
              Number((details as Record<string, unknown>).retries ?? 0) >= 2)
          );
        })()
    );
    if (failed.length < minimum) return [];
    return [
      {
        routine,
        count: failed.length,
        runIds: failed.slice(0, minimum).map(item => item.id),
        latestStartedAt: new Date(failed[0].startedAt).toISOString(),
      },
    ];
  });
}

export async function listIngestionReport(
  size = 20,
  filters: IngestionReportFilters = {}
) {
  const db = await getDb();
  if (!db)
    return {
      runs: [],
      alerts: [],
      criticalAlerts: [],
      consecutiveFailures: [],
      sourceMetrics: [],
      sourceTelemetry: [],
      freshness: [],
      timeline: [],
      reconciliationBySource: [],
      weeklyTrend: [],
      weeklySummary: {
        runs: 0,
        retries: 0,
        fallbackList: 0,
        duplicates: 0,
        missingCoordinates: 0,
        outOfBoundsCoordinates: 0,
        inconsistentRuns: 0,
        degradedRuns: 0,
        rejectedEvents: 0,
        rejectedPastEvents: 0,
        rejectedOtherReasons: 0,
      },
      metaStatus: {
        status: "never" as const,
        lastSuccessfulSync: null,
        lastAttempt: null,
      },
      scheduleStatus: await listRoutineScheduleStatus(),
      automationStatus: buildAutomationStatusSnapshot([]),
      filterEvaluatedAt: new Date().toISOString(),
      pastEventRejectionThreshold: getPastEventRejectionThreshold(),
      totals: { succeeded: 0, failed: 0, partial: 0, imported: 0 },
    };
  const safeSize = Math.min(Math.max(size, 1), 50);
  const periodDays = filters.periodDays ?? 7;
  const cutoff = periodDays === "all" ? null : new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const sqlFilters = cutoff ? [gte(ingestionRuns.startedAt, cutoff)] : [];
  if (filters.routine)
    sqlFilters.push(eq(ingestionRuns.routine, filters.routine));
  if (filters.status) sqlFilters.push(eq(ingestionRuns.status, filters.status));
  if (filters.runId) sqlFilters.push(eq(ingestionRuns.id, filters.runId));
  if (filters.sourceKey)
    sqlFilters.push(eq(ingestionRuns.sourceKey, filters.sourceKey));
  const runsRaw = await db
    .select()
    .from(ingestionRuns)
    .where(and(...sqlFilters))
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(Math.max(safeSize * 4, 100));
  const runs = runsRaw
    .filter(
      run => (!filters.trigger || runTrigger(run.details) === filters.trigger) &&
        (filters.executionKind === "all" || !filters.executionKind || (filters.executionKind === "simulated" ? isSandboxExecution(run.details) : !isSandboxExecution(run.details)))
    )
    .slice(0, safeSize);
  const trendRunsRaw = await db
    .select()
    .from(ingestionRuns)
    .where(cutoff ? gte(ingestionRuns.startedAt, cutoff) : undefined)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(500);
  const trendRuns = trendRunsRaw.filter(run => filters.executionKind === "all" || !filters.executionKind || (filters.executionKind === "simulated" ? isSandboxExecution(run.details) : !isSandboxExecution(run.details)));
  const metaRuns = await db
    .select({
      status: ingestionRuns.status,
      startedAt: ingestionRuns.startedAt,
      finishedAt: ingestionRuns.finishedAt,
    })
    .from(ingestionRuns)
    .where(eq(ingestionRuns.sourceKey, "instagram"))
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(100);
  const alerts = await db
    .select({
      id: operationalAlerts.id,
      integration: operationalAlerts.integration,
      severity: operationalAlerts.severity,
      alertType: operationalAlerts.alertType,
      slaMinutes: operationalAlerts.slaMinutes,
      runId: operationalAlerts.runId,
      title: operationalAlerts.title,
      message: operationalAlerts.message,
      isResolved: operationalAlerts.isResolved,
      createdAt: operationalAlerts.createdAt,
    })
    .from(operationalAlerts)
    .orderBy(desc(operationalAlerts.createdAt))
    .limit(safeSize);
  const [totals] = await db
    .select({
      succeeded: sql<number>`sum(status = 'succeeded')`,
      failed: sql<number>`sum(status = 'failed')`,
      partial: sql<number>`sum(status = 'partial')`,
      imported: sql<number>`coalesce(sum(importedCount), 0)`,
    })
    .from(ingestionRuns);
  const sourceRows = await db
    .select({
      sourceKey: ingestionRuns.sourceKey,
      imported: sql<number>`coalesce(sum(${ingestionRuns.importedCount}), 0)`,
      runs: sql<number>`count(*)`,
      failed: sql<number>`sum(status = 'failed')`,
    })
    .from(ingestionRuns)
    .groupBy(ingestionRuns.sourceKey)
    .orderBy(desc(sql`sum(${ingestionRuns.importedCount})`));
  const sourceConfigs = await db.select().from(ingestionSources);
  const sourceMetricGroups = new Map<string, { imported: number; runs: number; failed: number; realSuccesses: number; simulated: number }>();
  for (const run of trendRuns) {
    const sourceKey = String(run.sourceKey ?? "unknown");
    const current = sourceMetricGroups.get(sourceKey) ?? { imported: 0, runs: 0, failed: 0, realSuccesses: 0, simulated: 0 };
    const simulated = isSandboxExecution(run.details);
    current.runs += 1;
    current.imported += Number(run.importedCount ?? 0);
    if (run.status === "failed") current.failed += 1;
    if (simulated) current.simulated += 1;
    else if (run.status === "succeeded") current.realSuccesses += 1;
    sourceMetricGroups.set(sourceKey, current);
  }
  const sourceMetrics = Array.from(sourceMetricGroups.entries()).map(([sourceKey, value]) => ({
    sourceKey,
    imported: value.imported,
    runs: value.runs,
    failed: value.failed,
    realSuccesses: value.realSuccesses,
    simulatedExecutions: value.simulated,
    realCoverage: value.runs > 0 ? Number((value.realSuccesses / value.runs).toFixed(4)) : 0,
  }));
  const sourceTelemetry = buildSourceTelemetryForTest(trendRuns.map(run => ({ sourceKey: run.sourceKey, status: String(run.status), durationMs: run.durationMs, httpStatus: run.httpStatus, details: run.details })));
  const performanceAlerts = findConsecutiveP95PerformanceAlertsForTest(trendRuns.map(run => ({ sourceKey: run.sourceKey, status: String(run.status), startedAt: run.startedAt, durationMs: run.durationMs })), new Map(sourceConfigs.map(source => [source.sourceKey, source.p95LatencyThresholdMs ?? 3000])));
  await Promise.all(performanceAlerts.map(async alert => { const message = `Desempenho degradado: P95 de ${Math.round(alert.p95LatencyMs)} ms em ${alert.sourceKey}, acima do limite de ${alert.thresholdMs} ms por ${alert.consecutiveRuns} rodadas consecutivas.`; await handleIngestionFailureAlert({ routine: "performance-monitor", sourceKey: alert.sourceKey, integration: alert.sourceKey.startsWith("instagram") ? "meta" : "public", severity: "WARNING", alertType: "performance_degraded", message }); await notifyPerformanceDegradationWebhook({ ...alert, message }); }));
  const sourceTelemetryHistory = buildSourceTelemetryHistoryForTest(trendRuns.map(run => ({ sourceKey: run.sourceKey, status: String(run.status), startedAt: run.startedAt, finishedAt: run.finishedAt, durationMs: run.durationMs, details: run.details })));
  const freshness = sourceConfigs.map(source => ({
    sourceKey: source.sourceKey,
    name: source.name,
    kind: source.kind,
    lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null,
    expectedMinutes: source.frequencyMinutes,
    state: getFreshnessState(source.lastSuccessAt, source.frequencyMinutes),
  }));
  const feedLastSuccess = trendRuns
    .filter(run => run.status === "succeeded")
    .sort(
      (a, b) =>
        new Date(b.finishedAt ?? b.startedAt).getTime() -
        new Date(a.finishedAt ?? a.startedAt).getTime()
    )[0];
  freshness.unshift({
    sourceKey: "feed",
    name: "Feed geral",
    kind: "public",
    lastSuccessAt: feedLastSuccess
      ? new Date(
          feedLastSuccess.finishedAt ?? feedLastSuccess.startedAt
        ).toISOString()
      : null,
    expectedMinutes: 1440,
    state: getFreshnessState(
      feedLastSuccess?.finishedAt ?? feedLastSuccess?.startedAt,
      1440
    ),
  });
  const timeline: IngestionTimelineEntry[] = runs.flatMap(run => {
    const details = parseDetails(run.details);
    const retryCount = findMetric(details, "retries");
    const base: IngestionTimelineEntry[] = [
      {
        id: `run-${run.id}-start`,
        runId: String(run.id),
        kind: "heartbeat",
        timestamp: new Date(run.startedAt).toISOString(),
        label: `${run.routine} iniciado`,
        status: run.status,
        sourceKey: run.sourceKey,
      },
    ];
    const finish: IngestionTimelineEntry[] = run.finishedAt
      ? [
          {
            id: `run-${run.id}-finish`,
            runId: String(run.id),
            kind: "ingestion",
            timestamp: new Date(run.finishedAt).toISOString(),
            label: `${run.routine} ${run.status}`,
            status: run.status,
            sourceKey: run.sourceKey,
          },
        ]
      : [];
    const retries: IngestionTimelineEntry[] =
      retryCount > 0
        ? [
            {
              id: `run-${run.id}-retry`,
              runId: String(run.id),
              kind: "retry",
              timestamp: new Date(
                run.finishedAt ?? run.startedAt
              ).toISOString(),
              label: `${retryCount} retry(s) registrado(s)`,
              status: run.status,
              sourceKey: run.sourceKey,
            },
          ]
        : [];
    return [...base, ...retries, ...finish];
  });
  timeline.push(
    ...alerts.map(alert => ({
      id: `alert-${alert.id}`,
      runId: alert.runId ?? "—",
      kind: "alert" as const,
      timestamp: new Date(alert.createdAt).toISOString(),
      label: alert.title,
      status: alert.severity,
      sourceKey: alert.integration,
    }))
  );
  timeline.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  timeline.splice(80);
  const serializableRuns = runs.map(serializeIngestionRunForTest);
  const serializableAlerts = alerts.map(serializeOperationalAlertForTest);
  const consecutiveFailures = findConsecutiveFailureAlertsForTest(
    runs.map(run => ({
      id: Number(run.id),
      routine: String(run.routine ?? ""),
      sourceKey: run.sourceKey == null ? null : String(run.sourceKey),
      status: String(run.status),
      startedAt: new Date(run.startedAt),
      details: run.details,
    }))
  );
  await Promise.all(
    consecutiveFailures.map(alert => notifyConsecutiveFailureWebhook(alert))
  );
  const criticalAlerts = serializableAlerts.filter(
    alert =>
      alert.severity === "CRITICAL" ||
      isCriticalIngestionFailure(`${alert.title} ${alert.message}`)
  );
  const automationStatus = buildAutomationStatusSnapshot(
    runs.map(run => ({
      id: Number(run.id),
      routine: String(run.routine ?? ""),
      sourceKey: run.sourceKey == null ? null : String(run.sourceKey),
      status: String(run.status),
      startedAt: new Date(run.startedAt),
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
      details: run.details,
    }))
  );
  return normalizeReportForTransport({
    runs: serializableRuns,
    alerts: serializableAlerts,
    criticalAlerts,
    consecutiveFailures,
    sourceMetrics,
    sourceTelemetry,
    sourceTelemetryHistory,
    freshness,
    timeline,
    reconciliationBySource: buildSourceReconciliationForTest(trendRuns),
    weeklyTrend: buildWeeklyTrend(trendRuns),
    weeklySummary: buildWeeklyOperationalSummary(trendRuns),
    metaStatus: buildMetaIntegrationStatusForTest(metaRuns),
    scheduleStatus: await listRoutineScheduleStatus(),
    automationStatus,
    filterEvaluatedAt: new Date().toISOString(),
    pastEventRejectionThreshold: getPastEventRejectionThreshold(),
    totals: {
      succeeded: Number(totals?.succeeded ?? 0),
      failed: Number(totals?.failed ?? 0),
      partial: Number(totals?.partial ?? 0),
      imported: Number(totals?.imported ?? 0),
    },
  });
}

export function sanitizeReprocessErrorForTest(error: unknown) {
  if (error instanceof InstagramIntegrationFailure) {
    const status = getMetaFailureStatus(error);
    const suffix = status ? ` (HTTP ${status})` : "";
    return `Falha na integração ${error.integration}${suffix}`;
  }
  if (error instanceof Error) return error.message.slice(0, 240);
  return "Falha desconhecida durante o reprocessamento";
}

export function createSanitizedReprocessErrorForTest(error: unknown) {
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: sanitizeReprocessErrorForTest(error),
  });
}

export function normalizeManualReprocessResultForTest(input: unknown) {
  const value =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const counts =
    value.counts && typeof value.counts === "object"
      ? (value.counts as Record<string, unknown>)
      : {};
  return {
    ok: value.ok === true,
    sourceKey: value.sourceKey === "instagram" ? "instagram" : "public",
    routine:
      value.routine === "instagram-agenda"
        ? "instagram-agenda"
        : "manual-reprocess",
    imported: Number.isFinite(Number(value.imported))
      ? Number(value.imported)
      : 0,
    counts: {
      read: Number.isFinite(Number(counts.read)) ? Number(counts.read) : 0,
      filtered: Number.isFinite(Number(counts.filtered))
        ? Number(counts.filtered)
        : 0,
      persisted: Number.isFinite(Number(counts.persisted))
        ? Number(counts.persisted)
        : 0,
      duplicates: Number.isFinite(Number(counts.duplicates))
        ? Number(counts.duplicates)
        : 0,
    },
    degraded: value.degraded === true,
    accepted: value.accepted === true,
  } as const;
}

export async function reprocessIngestionSource(
  sourceKey: "public" | "instagram"
) {
  let runId: number | undefined;
  try {
    const active = await listIngestionReport(20);
    const running = active.runs.some(
      run => run.status === "running" && run.sourceKey === sourceKey
    );
    if (running) throw new Error("Essa fonte já está em processamento");
    if (sourceKey === "instagram") {
      const { runInstagramAgendaStep } = await import("./agenda-routine");
      // O registro precisa existir antes do ACK. Em ambientes serverless, lançar
      // apenas o worker em background antes de inserir o run pode encerrar o
      // processo após a resposta e perder a auditoria da execução.
      runId = await startIngestionRun({
        routine: "instagram-agenda",
        sourceKey: "instagram",
      });
      if (!runId) {
        return {
          ok: false as const,
          sourceKey,
          routine: "instagram-agenda" as const,
          imported: 0,
          counts: { read: 0, filtered: 0, persisted: 0, duplicates: 0 },
          degraded: false,
          error: "Não foi possível registrar a execução manual",
        };
      }
      void runInstagramAgendaStep({ runId, trigger: "manual" }).catch(error => {
        console.error("[Manual Instagram] Worker encerrado após registro", {
          runId,
          error: sanitizeReprocessErrorForTest(error),
        });
      });
      return normalizeManualReprocessResultForTest({
        ok: true,
        sourceKey: "instagram",
        routine: "instagram-agenda",
        imported: 0,
        counts: { read: 0, filtered: 0, persisted: 0, duplicates: 0 },
        degraded: false,
        accepted: true,
      });
    }
    runId = await startIngestionRun({ routine: "manual-reprocess", sourceKey });
    const { runPublicAgendaStep } = await import("./agenda-routine");
    const result = await runPublicAgendaStep();
    const pipeline =
      (result as { result?: Record<string, unknown> }).result ?? {};
    const imported = Number(pipeline.imported ?? 0);
    const counts = {
      read: Number(pipeline.read ?? 0),
      filtered: Number(pipeline.filtered ?? 0),
      persisted: Number(pipeline.persisted ?? imported),
      duplicates: Number(pipeline.duplicates ?? 0),
    };
    await finishIngestionRun(runId, {
      status: "succeeded",
      importedCount: imported,
      details: { imported, counts },
      routine: "manual-reprocess",
      sourceKey,
    });
    return normalizeManualReprocessResultForTest({
      ok: true,
      sourceKey: "public",
      routine: "manual-reprocess",
      imported,
      counts,
      degraded: false,
    });
  } catch (error) {
    const safeMessage = sanitizeReprocessErrorForTest(error);
    if (runId)
      await finishIngestionRun(runId, {
        status: "failed",
        failedCount: 1,
        details: { message: safeMessage },
        routine: "manual-reprocess",
        sourceKey,
      });
    return {
      ok: false as const,
      sourceKey,
      routine:
        sourceKey === "instagram"
          ? ("instagram-agenda" as const)
          : ("manual-reprocess" as const),
      imported: 0,
      counts: { read: 0, filtered: 0, persisted: 0, duplicates: 0 },
      degraded:
        sourceKey === "instagram" && isGracefullyDegradedMetaFailure(error),
      error: safeMessage,
    };
  }
}

export function buildWeeklyTrendForTest(
  runs: Array<{
    routine: string;
    sourceKey: string | null;
    status: string;
    importedCount: number;
    startedAt: Date;
    details: unknown;
  }>
) {
  return buildWeeklyTrend(runs);
}

export function getPastEventRejectionQualityForTest(
  input: { read: number; rejectedPastEvents: number },
  threshold = getPastEventRejectionThreshold()
) {
  const read = Math.max(0, Number(input.read) || 0);
  const rejectedPastEvents = Math.max(0, Number(input.rejectedPastEvents) || 0);
  const percentage = read === 0 ? 0 : rejectedPastEvents / read;
  return {
    read,
    rejectedPastEvents,
    percentage,
    exceedsThreshold: read > 0 && percentage > threshold,
  };
}

export function isZeroMediaMetaRunForTest(
  run: { routine: string; sourceKey: string | null },
  details: unknown
) {
  return isZeroMediaMetaRun(run, details);
}

export type LiveIngestionLog = {
  id: string;
  runId: string;
  kind: "heartbeat" | "ingestion" | "retry" | "alert";
  timestamp: string;
  label: string;
  status: string;
  sourceKey: string | null;
  message: string | null;
  sandboxRestricted: boolean;
};

function readLogMessage(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return safeReportError(value);
}

export async function listIngestionLogs(limit = 80): Promise<{
  updatedAt: string;
  isLive: boolean;
  logs: LiveIngestionLog[];
}> {
  const safeLimit = Math.min(120, Math.max(10, Math.trunc(limit)));
  const db = await getDb();
  if (!db) {
    return { updatedAt: new Date().toISOString(), isLive: false, logs: [] };
  }

  const runs = await db
    .select({
      id: ingestionRuns.id,
      routine: ingestionRuns.routine,
      sourceKey: ingestionRuns.sourceKey,
      status: ingestionRuns.status,
      startedAt: ingestionRuns.startedAt,
      finishedAt: ingestionRuns.finishedAt,
      details: ingestionRuns.details,
    })
    .from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(safeLimit);
  const alerts = await db
    .select({
      id: operationalAlerts.id,
      runId: operationalAlerts.runId,
      integration: operationalAlerts.integration,
      title: operationalAlerts.title,
      message: operationalAlerts.message,
      severity: operationalAlerts.severity,
      createdAt: operationalAlerts.createdAt,
    })
    .from(operationalAlerts)
    .orderBy(desc(operationalAlerts.createdAt))
    .limit(Math.min(30, safeLimit));

  const logs: LiveIngestionLog[] = [];
  for (const run of runs) {
    const sourceKey = run.sourceKey ?? run.routine;
    const details = parseDetails(run.details);
    const sandboxRestricted = isSandboxRestrictedDetails(details);
    logs.push({
      id: `run-${run.id}-started`,
      runId: String(run.id),
      kind: "ingestion",
      timestamp: new Date(run.startedAt).toISOString(),
      label: `${run.routine} iniciou`,
      status: run.status,
      sourceKey,
      message: null,
      sandboxRestricted,
    });
    if (run.finishedAt) {
      logs.push({
        id: `run-${run.id}-finished`,
        runId: String(run.id),
        kind: "ingestion",
        timestamp: new Date(run.finishedAt).toISOString(),
        label: `${run.routine} terminou`,
        status: run.status,
        sourceKey,
        message: null,
        sandboxRestricted,
      });
    }


    const root =
      details && typeof details === "object"
        ? (details as Record<string, unknown>)
        : {};
    const retryHistory = Array.isArray(root.retryHistory)
      ? root.retryHistory
      : Array.isArray(root.retriesHistory)
        ? root.retriesHistory
        : [];
    retryHistory.slice(0, 10).forEach((entry, index) => {
      const item =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      const timestamp =
        typeof item.timestamp === "string"
          ? item.timestamp
          : run.startedAt.toISOString();
      logs.push({
        id: `run-${run.id}-retry-${index}`,
        runId: String(run.id),
        kind: "retry",
        timestamp: new Date(timestamp).toISOString(),
        label: `${run.routine} retry ${Number(item.attempt ?? index + 1) || index + 1}`,
        status: "retry",
        sourceKey,
        message: readLogMessage(item.reason ?? item.error),
        sandboxRestricted: sandboxRestricted || isSandboxRestrictedDetails(item.reason ?? item.error),
      });
    });

    const errors = Array.isArray(root.errors) ? root.errors : [];
    errors.slice(0, 10).forEach((entry, index) => {
      const item =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      logs.push({
        id: `run-${run.id}-error-${index}`,
        runId: String(run.id),
        kind: "alert",
        timestamp: new Date(run.finishedAt ?? run.startedAt).toISOString(),
        label: `${run.routine} falha de fonte`,
        status: "error",
        sourceKey:
          typeof item.sourceKey === "string" ? item.sourceKey : sourceKey,
        message: readLogMessage(item.message ?? entry),
        sandboxRestricted: sandboxRestricted || isSandboxRestrictedDetails(item.message ?? entry),
      });
    });
  }

  alerts.forEach(alert => {
    logs.push({
      id: `alert-${alert.id}`,
      runId: alert.runId ? String(alert.runId) : "-",
      kind: "alert",
      timestamp: new Date(alert.createdAt).toISOString(),
      label: `${alert.severity}: ${alert.title}`,
      status: alert.severity.toLowerCase(),
      sourceKey: alert.integration,
      message: readLogMessage(alert.message),
      sandboxRestricted: isSandboxRestrictedDetails(alert.message),
    });
  });

  logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return normalizeReportForTransport({
    updatedAt: new Date().toISOString(),
    isLive: true,
    logs: logs.slice(0, safeLimit),
  });
}
