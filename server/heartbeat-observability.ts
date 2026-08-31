import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { appSettings, exportJobsAlertSettingsAudit, heartbeatExecutionEvents } from "../drizzle/schema";
import { getDb, recordOperationalAlert } from "./db";

export type HeartbeatEventType = "started" | "step" | "log" | "alert" | "completed" | "failed" | "timeout";
export type HeartbeatExecutionStatus = "running" | "succeeded" | "failed" | "timeout" | "unknown";
export type HeartbeatHealthEnvironment = "development" | "preview" | "production";
export type HeartbeatHealthSeverity = "INFO" | "WARNING" | "CRITICAL";

export function calculateP95(values: number[]) {
  const sorted = values.filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const rank = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return Math.round(sorted[rank] ?? 0);
}

export type HeartbeatHealthSettings = {
  environment: HeartbeatHealthEnvironment;
  maxDurationMs: number;
  failureThreshold: number;
  cooldownHours: number;
  minSuccessRate: number;
  maxP95DurationMs: number;
};

const SETTINGS_PREFIX = "heartbeat.health.";
const DEFAULT_SETTINGS: Omit<HeartbeatHealthSettings, "environment"> = {
  maxDurationMs: 180_000,
  failureThreshold: 1,
  cooldownHours: 24,
  minSuccessRate: 0.8,
  maxP95DurationMs: 180_000,
};

function environment(): HeartbeatHealthEnvironment {
  return process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "preview" ? "preview" : "development";
}

function settingKey(env: HeartbeatHealthEnvironment) {
  return `${SETTINGS_PREFIX}${env}`;
}

function clampSettings(input: Partial<HeartbeatHealthSettings>, env: HeartbeatHealthEnvironment): HeartbeatHealthSettings {
  return {
    environment: env,
    maxDurationMs: Math.min(600_000, Math.max(100, Math.trunc(input.maxDurationMs ?? DEFAULT_SETTINGS.maxDurationMs))),
    failureThreshold: Math.min(10, Math.max(1, Math.trunc(input.failureThreshold ?? DEFAULT_SETTINGS.failureThreshold))),
    cooldownHours: Math.min(168, Math.max(1, Math.trunc(input.cooldownHours ?? DEFAULT_SETTINGS.cooldownHours))),
    minSuccessRate: Math.min(1, Math.max(0, Number(input.minSuccessRate ?? DEFAULT_SETTINGS.minSuccessRate))),
    maxP95DurationMs: Math.min(600_000, Math.max(100, Math.trunc(input.maxP95DurationMs ?? DEFAULT_SETTINGS.maxP95DurationMs))),
  };
}

function parseMetadata(metadataJson?: string | null) {
  if (!metadataJson) return {};
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value)));
  } catch {
    return {};
  }
}

export async function recordHeartbeatExecutionEvent(input: {
  heartbeatExecutionId: string;
  eventType: HeartbeatEventType;
  sequence: number;
  timestamp?: Date;
  durationMs?: number | null;
  status?: string | null;
  message?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const event = {
    id: randomUUID(),
    heartbeatExecutionId: input.heartbeatExecutionId.trim().slice(0, 160),
    eventType: input.eventType,
    sequence: Math.max(0, Math.trunc(input.sequence)),
    timestamp: input.timestamp ?? new Date(),
    durationMs: input.durationMs == null ? null : Math.max(0, Math.trunc(input.durationMs)),
    status: input.status?.trim().slice(0, 64) || null,
    message: input.message?.trim().slice(0, 20_000) || null,
    metadataJson: input.metadata ? JSON.stringify(parseMetadata(JSON.stringify(input.metadata))) : null,
  };
  await db.insert(heartbeatExecutionEvents).values(event);
  return { id: event.id, heartbeatExecutionId: event.heartbeatExecutionId, sequence: event.sequence };
}

export async function listHeartbeatExecutionEvents(input: {
  heartbeatExecutionId: string;
  eventType?: HeartbeatEventType;
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 50)));
  const conditions = [eq(heartbeatExecutionEvents.heartbeatExecutionId, input.heartbeatExecutionId.trim())];
  if (input.eventType) conditions.push(eq(heartbeatExecutionEvents.eventType, input.eventType));
  if (input.from) conditions.push(gte(heartbeatExecutionEvents.timestamp, new Date(input.from)));
  if (input.to) conditions.push(lte(heartbeatExecutionEvents.timestamp, new Date(input.to)));
  const where = and(...conditions);
  const rows = await db.select().from(heartbeatExecutionEvents).where(where).orderBy(asc(heartbeatExecutionEvents.sequence), asc(heartbeatExecutionEvents.timestamp)).limit(limit + 1).offset(offset);
  const hasNextPage = rows.length > limit;
  const items = rows.slice(0, limit).map(row => ({
    id: row.id,
    heartbeatExecutionId: row.heartbeatExecutionId,
    eventType: row.eventType as HeartbeatEventType,
    sequence: row.sequence,
    timestamp: row.timestamp.toISOString(),
    durationMs: row.durationMs == null ? null : Number(row.durationMs),
    status: row.status ?? null,
    message: row.message ?? null,
    metadata: parseMetadata(row.metadataJson),
  }));
  return { items, total: offset + items.length + (hasNextPage ? 1 : 0), offset, limit, nextOffset: hasNextPage ? offset + limit : null, hasNextPage };
}

export async function getHeartbeatExecutionSummary(heartbeatExecutionId: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const rows = await db.select().from(heartbeatExecutionEvents).where(eq(heartbeatExecutionEvents.heartbeatExecutionId, heartbeatExecutionId.trim())).orderBy(asc(heartbeatExecutionEvents.sequence), asc(heartbeatExecutionEvents.timestamp));
  const started = rows.find(row => row.eventType === "started");
  const terminal = [...rows].reverse().find(row => ["completed", "failed", "timeout"].includes(row.eventType));
  const status: HeartbeatExecutionStatus = terminal?.eventType === "completed" ? "succeeded" : terminal?.eventType === "failed" ? "failed" : terminal?.eventType === "timeout" ? "timeout" : started ? "running" : "unknown";
  const durationMs = terminal && started ? Math.max(0, terminal.timestamp.getTime() - started.timestamp.getTime()) : null;
  return {
    heartbeatExecutionId,
    startedAt: started?.timestamp.toISOString() ?? null,
    finishedAt: terminal?.timestamp.toISOString() ?? null,
    durationMs,
    status,
    eventCount: rows.length,
    alertCount: rows.filter(row => row.eventType === "alert").length,
  };
}

export async function listHeartbeatExecutionEventsForExport(input: { heartbeatExecutionId: string; eventType?: HeartbeatEventType; from?: string; to?: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const conditions = [eq(heartbeatExecutionEvents.heartbeatExecutionId, input.heartbeatExecutionId.trim())];
  if (input.eventType) conditions.push(eq(heartbeatExecutionEvents.eventType, input.eventType));
  if (input.from) conditions.push(gte(heartbeatExecutionEvents.timestamp, new Date(input.from)));
  if (input.to) conditions.push(lte(heartbeatExecutionEvents.timestamp, new Date(input.to)));
  const rows = await db.select().from(heartbeatExecutionEvents).where(and(...conditions)).orderBy(asc(heartbeatExecutionEvents.sequence), asc(heartbeatExecutionEvents.timestamp)).limit(10_000);
  return rows.map(row => ({
    id: row.id,
    heartbeatExecutionId: row.heartbeatExecutionId,
    eventType: row.eventType as HeartbeatEventType,
    sequence: row.sequence,
    timestamp: row.timestamp.toISOString(),
    durationMs: row.durationMs == null ? null : Number(row.durationMs),
    status: row.status ?? null,
    message: row.message ?? null,
    metadata: parseMetadata(row.metadataJson),
  }));
}

export async function listHeartbeatHealthSettingsHistory(input: { environment: HeartbeatHealthEnvironment; offset?: number; limit?: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.min(50, Math.max(1, Math.trunc(input.limit ?? 20)));
  const rows = await db.select().from(exportJobsAlertSettingsAudit).where(eq(exportJobsAlertSettingsAudit.environment, input.environment)).orderBy(desc(exportJobsAlertSettingsAudit.changedAt)).limit(limit + 1).offset(offset);
  const hasNextPage = rows.length > limit;
  return { items: rows.slice(0, limit).map(row => ({ id: String(row.id), environment: row.environment as HeartbeatHealthEnvironment, previousValue: row.previousValue, nextValue: row.nextValue, changedByOpenId: row.changedByOpenId, changedAt: row.changedAt.toISOString() })), offset, limit, nextOffset: hasNextPage ? offset + limit : null, hasNextPage };
}

export async function getHeartbeatHealthSettings(env = environment()): Promise<HeartbeatHealthSettings> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, settingKey(env))).limit(1);
  try {
    return clampSettings(row?.value ? JSON.parse(row.value) as Partial<HeartbeatHealthSettings> : {}, env);
  } catch {
    return clampSettings({}, env);
  }
}

export async function updateHeartbeatHealthSettings(input: HeartbeatHealthSettings & { changedByOpenId: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const previous = await getHeartbeatHealthSettings(input.environment);
  const next = clampSettings(input, input.environment);
  const now = new Date();
  const serialized = JSON.stringify({ maxDurationMs: next.maxDurationMs, failureThreshold: next.failureThreshold, cooldownHours: next.cooldownHours, minSuccessRate: next.minSuccessRate, maxP95DurationMs: next.maxP95DurationMs });
  await db.insert(appSettings).values({ key: settingKey(input.environment), value: serialized, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { value: serialized, updatedAt: now } });
  await db.insert((await import("../drizzle/schema")).exportJobsAlertSettingsAudit).values({ environment: input.environment, previousValue: JSON.stringify(previous), nextValue: serialized, changedByOpenId: input.changedByOpenId.slice(0, 160), changedAt: now });
  return { ...next, changedByOpenId: input.changedByOpenId.slice(0, 160), changedAt: now.toISOString() };
}

export async function getHeartbeatExecutionStats(input: { from?: string; to?: string; environment?: HeartbeatHealthEnvironment }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const to = input.to ? new Date(input.to) : new Date();
  const from = input.from ? new Date(input.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const rows = await db.select().from(heartbeatExecutionEvents).where(and(gte(heartbeatExecutionEvents.timestamp, from), lte(heartbeatExecutionEvents.timestamp, to))).orderBy(asc(heartbeatExecutionEvents.timestamp), asc(heartbeatExecutionEvents.sequence));
  const executions = new Map<string, { startedAt: Date | null; terminalAt: Date | null; status: HeartbeatExecutionStatus; durationMs: number | null; incidentCount: number }>();
  for (const row of rows) {
    const current = executions.get(row.heartbeatExecutionId) ?? { startedAt: null, terminalAt: null, status: "unknown" as HeartbeatExecutionStatus, durationMs: null, incidentCount: 0 };
    if (row.eventType === "started" && !current.startedAt) current.startedAt = row.timestamp;
    if (row.eventType === "alert" || row.eventType === "failed" || row.eventType === "timeout") current.incidentCount += 1;
    if (row.eventType === "completed" || row.eventType === "failed" || row.eventType === "timeout") {
      current.terminalAt = row.timestamp;
      current.status = row.eventType === "completed" ? "succeeded" : row.eventType;
      current.durationMs = row.durationMs ?? (current.startedAt ? Math.max(0, row.timestamp.getTime() - current.startedAt.getTime()) : null);
    }
    executions.set(row.heartbeatExecutionId, current);
  }
  const values = Array.from(executions.values());
  const durations = values.map(value => value.durationMs).filter((value): value is number => value != null);
  const totalExecutions = values.length;
  const successfulExecutions = values.filter(value => value.status === "succeeded").length;
  const points = new Map<string, { totalExecutions: number; successfulExecutions: number; durations: number[]; incidentCount: number }>();
  for (const value of values) {
    const date = value.startedAt ?? value.terminalAt;
    if (!date) continue;
    const bucket = date.toISOString().slice(0, 10);
    const point = points.get(bucket) ?? { totalExecutions: 0, successfulExecutions: 0, durations: [], incidentCount: 0 };
    point.totalExecutions += 1;
    if (value.status === "succeeded") point.successfulExecutions += 1;
    if (value.durationMs != null) point.durations.push(value.durationMs);
    point.incidentCount += value.incidentCount;
    points.set(bucket, point);
  }
  return { from: from.toISOString(), to: to.toISOString(), totalExecutions, successfulExecutions, successRate: totalExecutions ? successfulExecutions / totalExecutions : 0, p95DurationMs: calculateP95(durations), incidentCount: values.reduce((sum, value) => sum + value.incidentCount, 0), points: Array.from(points.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([bucketStart, point]) => ({ bucketStart: `${bucketStart}T00:00:00.000Z`, totalExecutions: point.totalExecutions, successfulExecutions: point.successfulExecutions, successRate: point.totalExecutions ? point.successfulExecutions / point.totalExecutions : 0, p95DurationMs: calculateP95(point.durations), incidentCount: point.incidentCount })) };
}

function metricDelta(current: number, previous: number) {
  const absolute = current - previous;
  return { absolute, percent: previous === 0 ? (current === 0 ? 0 : 100) : (absolute / Math.abs(previous)) * 100 };
}

export async function compareHeartbeatExecutionStats(input: { first: { from?: string; to?: string }; second: { from?: string; to?: string } }) {
  const [first, second] = await Promise.all([getHeartbeatExecutionStats(input.first), getHeartbeatExecutionStats(input.second)]);
  return {
    first,
    second,
    deltas: {
      successRate: metricDelta(second.successRate, first.successRate),
      p95DurationMs: metricDelta(second.p95DurationMs, first.p95DurationMs),
      incidentCount: metricDelta(second.incidentCount, first.incidentCount),
    },
  };
}

export async function getHeartbeatStatsExportRows(input: { first: { from?: string; to?: string }; second: { from?: string; to?: string } }) {
  const comparison = await compareHeartbeatExecutionStats(input);
  return [
    { period: "first", totalExecutions: comparison.first.totalExecutions, successfulExecutions: comparison.first.successfulExecutions, successRate: comparison.first.successRate, p95DurationMs: comparison.first.p95DurationMs, incidentCount: comparison.first.incidentCount },
    { period: "second", totalExecutions: comparison.second.totalExecutions, successfulExecutions: comparison.second.successfulExecutions, successRate: comparison.second.successRate, p95DurationMs: comparison.second.p95DurationMs, incidentCount: comparison.second.incidentCount },
    { period: "delta", totalExecutions: null, successfulExecutions: null, successRate: comparison.deltas.successRate.absolute, p95DurationMs: comparison.deltas.p95DurationMs.absolute, incidentCount: comparison.deltas.incidentCount.absolute },
  ];
}

export async function evaluateHeartbeatPerformance(input: {
  heartbeatExecutionId: string;
  successRate: number;
  p95DurationMs: number;
  environment?: HeartbeatHealthEnvironment;
}) {
  const env = input.environment ?? environment();
  const settings = await getHeartbeatHealthSettings(env);
  const alerts: Array<"heartbeat_success_rate_degraded" | "heartbeat_p95_degraded"> = [];
  if (input.successRate < settings.minSuccessRate) {
    await recordHeartbeatExecutionEvent({ heartbeatExecutionId: input.heartbeatExecutionId, eventType: "alert", sequence: 999_997, status: "success_rate_degraded", message: `Taxa de sucesso ${(input.successRate * 100).toFixed(1)}% abaixo do mínimo de ${(settings.minSuccessRate * 100).toFixed(1)}%.` });
    await recordOperationalAlert({ integration: "pipeline", alertType: "heartbeat_success_rate_degraded", severity: "WARNING", title: "Taxa de sucesso degradada no Heartbeat", message: `A execução ${input.heartbeatExecutionId} apresentou taxa de sucesso abaixo do limite configurado.`, runId: input.heartbeatExecutionId, slaMinutes: settings.cooldownHours * 60 });
    alerts.push("heartbeat_success_rate_degraded");
  }
  if (input.p95DurationMs > settings.maxP95DurationMs) {
    await recordHeartbeatExecutionEvent({ heartbeatExecutionId: input.heartbeatExecutionId, eventType: "alert", sequence: 999_996, durationMs: input.p95DurationMs, status: "p95_degraded", message: `P95 ${input.p95DurationMs}ms acima do limite de ${settings.maxP95DurationMs}ms.` });
    await recordOperationalAlert({ integration: "pipeline", alertType: "heartbeat_p95_degraded", severity: "WARNING", title: "P95 degradado no Heartbeat", message: `A execução ${input.heartbeatExecutionId} apresentou P95 acima do limite configurado.`, runId: input.heartbeatExecutionId, slaMinutes: settings.cooldownHours * 60 });
    alerts.push("heartbeat_p95_degraded");
  }
  const evaluatedAt = new Date();
  const { recordExportAlertEvaluationSnapshot } = await import("./filtered-story-export-jobs");
  await recordExportAlertEvaluationSnapshot({ environment: env, windowStartedAt: evaluatedAt, windowEndedAt: evaluatedAt, queueSize: Math.round(input.successRate * 100), previousQueueSize: Math.round(settings.minSuccessRate * 100), queueGrowth: Math.round((input.successRate - settings.minSuccessRate) * 100), expiredLeases: input.p95DurationMs, orphanedJobs: 0, growthThreshold: Math.max(1, Math.round(settings.maxP95DurationMs)), minimumQueueSize: Math.max(0, Math.round(settings.minSuccessRate * 100)), consecutiveWindows: settings.failureThreshold, severity: alerts.length ? "WARNING" : "INFO", decision: alerts.length ? "ALERT_CREATED" : "NO_ALERT", evaluatedByOpenId: "heartbeat-m2m", heartbeatExecutionId: input.heartbeatExecutionId });
  return { heartbeatExecutionId: input.heartbeatExecutionId, settings, alerts, evaluatedAt: evaluatedAt.toISOString() };
}

export async function evaluateHeartbeatHealth(input: {
  heartbeatExecutionId: string;
  status: HeartbeatExecutionStatus;
  durationMs: number | null;
  errorMessage?: string | null;
  environment?: HeartbeatHealthEnvironment;
}) {
  const env = input.environment ?? environment();
  const settings = await getHeartbeatHealthSettings(env);
  const alerts: Array<"heartbeat_execution_failed" | "heartbeat_duration_anomaly"> = [];
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const failureKey = `heartbeat.health.failures.${env}`;
  const [failureRow] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, failureKey)).limit(1);
  const previousFailures = failureRow?.value ? Math.max(0, Number.parseInt(failureRow.value, 10) || 0) : 0;
  const failureCount = input.status === "failed" || input.status === "timeout" ? previousFailures + 1 : 0;
  await db.insert(appSettings).values({ key: failureKey, value: String(failureCount) }).onDuplicateKeyUpdate({ set: { value: String(failureCount), updatedAt: new Date() } });
  if ((input.status === "failed" || input.status === "timeout") && failureCount >= settings.failureThreshold) {
    await recordHeartbeatExecutionEvent({ heartbeatExecutionId: input.heartbeatExecutionId, eventType: input.status === "timeout" ? "timeout" : "alert", sequence: 999_998, status: input.status, message: input.errorMessage ?? "Execução do Heartbeat falhou." });
    await recordOperationalAlert({ integration: "pipeline", alertType: "heartbeat_execution_failed", severity: "CRITICAL", title: "Falha na execução do Heartbeat", message: `A execução ${input.heartbeatExecutionId} terminou com status ${input.status} após ${failureCount} falha(s) consecutiva(s).`, runId: input.heartbeatExecutionId, slaMinutes: settings.cooldownHours * 60 });
    alerts.push("heartbeat_execution_failed");
  }
  if (input.durationMs != null && input.durationMs > settings.maxDurationMs) {
    await recordHeartbeatExecutionEvent({ heartbeatExecutionId: input.heartbeatExecutionId, eventType: "alert", sequence: 999_999, durationMs: input.durationMs, status: "duration_anomaly", message: `Duração ${input.durationMs}ms excedeu o limite de ${settings.maxDurationMs}ms.` });
    await recordOperationalAlert({ integration: "pipeline", alertType: "heartbeat_duration_anomaly", severity: "WARNING", title: "Duração anormal do Heartbeat", message: `A execução ${input.heartbeatExecutionId} levou ${input.durationMs}ms; limite configurado: ${settings.maxDurationMs}ms.`, runId: input.heartbeatExecutionId });
    alerts.push("heartbeat_duration_anomaly");
  }
  return { heartbeatExecutionId: input.heartbeatExecutionId, settings, alerts, evaluatedAt: new Date().toISOString() };
}
