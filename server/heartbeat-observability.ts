import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { appSettings, heartbeatExecutionEvents } from "../drizzle/schema";
import { getDb, recordOperationalAlert } from "./db";

export type HeartbeatEventType = "started" | "step" | "log" | "alert" | "completed" | "failed" | "timeout";
export type HeartbeatExecutionStatus = "running" | "succeeded" | "failed" | "timeout" | "unknown";
export type HeartbeatHealthEnvironment = "development" | "preview" | "production";
export type HeartbeatHealthSeverity = "INFO" | "WARNING" | "CRITICAL";

export type HeartbeatHealthSettings = {
  environment: HeartbeatHealthEnvironment;
  maxDurationMs: number;
  failureThreshold: number;
  cooldownHours: number;
};

const SETTINGS_PREFIX = "heartbeat.health.";
const DEFAULT_SETTINGS: Omit<HeartbeatHealthSettings, "environment"> = {
  maxDurationMs: 180_000,
  failureThreshold: 1,
  cooldownHours: 24,
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
  const serialized = JSON.stringify({ maxDurationMs: next.maxDurationMs, failureThreshold: next.failureThreshold, cooldownHours: next.cooldownHours });
  await db.insert(appSettings).values({ key: settingKey(input.environment), value: serialized, createdAt: now, updatedAt: now }).onDuplicateKeyUpdate({ set: { value: serialized, updatedAt: now } });
  await db.insert((await import("../drizzle/schema")).exportJobsAlertSettingsAudit).values({ environment: input.environment, previousValue: JSON.stringify(previous), nextValue: serialized, changedByOpenId: input.changedByOpenId.slice(0, 160), changedAt: now });
  return { ...next, changedByOpenId: input.changedByOpenId.slice(0, 160), changedAt: now.toISOString() };
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
