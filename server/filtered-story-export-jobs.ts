import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { filteredStoryExportJobs, operationalAlerts, appSettings, exportJobsAlertSettingsAudit } from "../drizzle/schema";
import { getDb, recordOperationalAlert } from "./db";
import { storageGet, storagePut } from "./storage";
import { buildFilteredStoriesCsv, listAllFilteredStories, type FilteredStoriesFilter } from "./ingestion-reports";

type ExportFormat = "csv" | "json";
type PersistentExportStatus = "queued" | "processing" | "completed" | "failed" | "cancelled" | "expired";
export type ExportFilters = FilteredStoriesFilter & { sort?: Array<{ column: "date" | "source" | "status"; direction: "asc" | "desc" }> };
export type ExportHistoryFilters = { format?: ExportFormat; status?: PersistentExportStatus; from?: string; to?: string; offset?: number; limit?: number; ownerOpenId: string };

const JOB_TTL_MS = 10 * 60 * 1000;
const LEASE_MS = 90 * 1000;
const MAX_RECOVERY_ATTEMPTS = 3;

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

type PublicJob = {
  jobId: string;
  status: PersistentExportStatus;
  progress: number;
  fileName: string | null;
  contentType: string | null;
  error: string | null;
  fileDeletePending: boolean;
};

function toPublicJob(row: typeof filteredStoryExportJobs.$inferSelect): PublicJob {
  return {
    jobId: row.id,
    status: row.status as PersistentExportStatus,
    progress: Math.min(100, Math.max(0, Number(row.progress))),
    fileName: row.fileName ?? null,
    contentType: row.contentType ?? null,
    error: row.errorMessage ?? null,
    fileDeletePending: Boolean(row.fileDeletePending),
  };
}

async function getOwnedJob(jobId: string, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const [row] = await db.select().from(filteredStoryExportJobs).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.createdByOpenId, ownerOpenId))).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Exportação não encontrada." });
  return { db, row };
}

function staleLeaseCondition(now: Date) {
  return or(isNull(filteredStoryExportJobs.leaseExpiresAt), lt(filteredStoryExportJobs.leaseExpiresAt, now));
}

async function processPersistentExportJob(jobId: string, ownerOpenId: string, recovered = false) {
  let owned: Awaited<ReturnType<typeof getOwnedJob>>;
  try {
    owned = await getOwnedJob(jobId, ownerOpenId);
  } catch {
    return false;
  }
  const { db } = owned;
  if (!["queued", "processing"].includes(owned.row.status)) return false;
  const leaseOwner = `export-worker-${randomUUID()}`;
  const now = new Date();
  const claimWhere = owned.row.status === "queued"
    ? and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.createdByOpenId, ownerOpenId), eq(filteredStoryExportJobs.status, "queued"))
    : and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.createdByOpenId, ownerOpenId), eq(filteredStoryExportJobs.status, "processing"), staleLeaseCondition(now));
  const claimResult = await db.update(filteredStoryExportJobs).set({ status: "processing", progress: recovered ? 10 : Math.max(10, Number(owned.row.progress)), leaseOwner, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), recoveryAttempts: recovered ? Number(owned.row.recoveryAttempts ?? 0) + 1 : Number(owned.row.recoveryAttempts ?? 0), lastRecoveredAt: recovered ? now : owned.row.lastRecoveredAt }).where(claimWhere);
  if ((claimResult as { affectedRows?: number }).affectedRows !== 1) return false;

  try {
    const [active] = await db.select({ status: filteredStoryExportJobs.status }).from(filteredStoryExportJobs).where(eq(filteredStoryExportJobs.id, jobId)).limit(1);
    if (!active || active.status === "cancelled") return false;
    const filters = JSON.parse(owned.row.filtersJson) as ExportFilters;
    const stories = await listAllFilteredStories(filters);
    await db.update(filteredStoryExportJobs).set({ progress: 70, leaseExpiresAt: new Date(Date.now() + LEASE_MS) }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.status, "processing"), eq(filteredStoryExportJobs.leaseOwner, leaseOwner)));
    const content = owned.row.format === "csv" ? buildFilteredStoriesCsv(stories) : JSON.stringify(stories);
    const format = owned.row.format as ExportFormat;
    const fileName = `stories-filtrados-${new Date().toISOString().slice(0, 10)}.${format}`;
    const contentType = format === "csv" ? "text/csv;charset=utf-8" : "application/json";
    const [latest] = await db.select({ status: filteredStoryExportJobs.status }).from(filteredStoryExportJobs).where(eq(filteredStoryExportJobs.id, jobId)).limit(1);
    if (latest?.status === "cancelled") return false;
    const stored = await storagePut(`exports/filtered-stories/${jobId}.${format}`, content, contentType);
    const completed = await db.update(filteredStoryExportJobs).set({ status: "completed", progress: 100, fileKey: stored.key, fileName, contentType, completedAt: new Date(), errorMessage: null, leaseOwner: null, leaseExpiresAt: null, fileDeletePending: false }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.status, "processing"), eq(filteredStoryExportJobs.leaseOwner, leaseOwner)));
    return (completed as { affectedRows?: number }).affectedRows !== 0;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 480) : "Falha interna na exportação.";
    await db.update(filteredStoryExportJobs).set({ status: "failed", progress: 100, errorMessage: "Não foi possível gerar a exportação com os filtros informados.", leaseOwner: null, leaseExpiresAt: null, fileDeletePending: Boolean(owned.row.fileKey) }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.status, "processing"), eq(filteredStoryExportJobs.leaseOwner, leaseOwner)));
    console.error("[FilteredStoryExportJob] failed", { jobId, message });
    return false;
  }
}

export async function createPersistentExportJob(input: { format: ExportFormat; filters: ExportFilters; createdByOpenId: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const jobId = randomUUID();
  const now = new Date();
  await db.insert(filteredStoryExportJobs).values({ id: jobId, format: input.format, status: "queued", progress: 0, filtersJson: JSON.stringify(input.filters), createdByOpenId: input.createdByOpenId.slice(0, 160), createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + JOB_TTL_MS), fileDeletePending: false, recoveryAttempts: 0 });
  setTimeout(() => void processPersistentExportJob(jobId, input.createdByOpenId.slice(0, 160)), 0);
  return { jobId, status: "queued" as const, progress: 0 as const };
}

export async function getPersistentExportJobStatus(jobId: string, ownerOpenId: string) {
  const { db, row } = await getOwnedJob(jobId, ownerOpenId);
  if (row.expiresAt.getTime() <= Date.now() && ["queued", "processing", "completed", "failed"].includes(row.status)) {
    await db.update(filteredStoryExportJobs).set({ status: "expired", progress: 100, leaseOwner: null, leaseExpiresAt: null, fileDeletePending: Boolean(row.fileKey) }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.createdByOpenId, ownerOpenId), inArray(filteredStoryExportJobs.status, ["queued", "processing", "completed", "failed"])));
    return { ...toPublicJob({ ...row, status: "expired", progress: 100, fileDeletePending: Boolean(row.fileKey) }), status: "expired" as const, progress: 100 };
  }
  return toPublicJob(row);
}

export async function getPersistentExportDownload(jobId: string, ownerOpenId: string) {
  const { row } = await getOwnedJob(jobId, ownerOpenId);
  if (row.status !== "completed" || !row.fileKey || row.fileDeletePending) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A exportação ainda não está pronta." });
  return { fileName: row.fileName ?? `export-${jobId}.json`, contentType: row.contentType ?? "application/octet-stream", downloadUrl: (await storageGet(row.fileKey)).url };
}

export async function cancelPersistentExportJob(jobId: string, ownerOpenId: string) {
  const { db, row } = await getOwnedJob(jobId, ownerOpenId);
  await db.update(filteredStoryExportJobs).set({ status: "cancelled", progress: 100, cancelledAt: new Date(), errorMessage: "Cancelada pelo administrador.", leaseOwner: null, leaseExpiresAt: null, fileDeletePending: Boolean(row.fileKey) }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.createdByOpenId, ownerOpenId), inArray(filteredStoryExportJobs.status, ["queued", "processing"])));
  return { success: true as const, jobId, status: "cancelled" as const };
}

export async function purgePersistentExportJobs(before?: string | { before?: string; requestedByOpenId?: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const cutoffValue = typeof before === "string" ? before : before?.before;
  const cutoff = cutoffValue ? new Date(cutoffValue) : new Date();
  const rows = await db.select({ id: filteredStoryExportJobs.id, fileKey: filteredStoryExportJobs.fileKey }).from(filteredStoryExportJobs).where(lt(filteredStoryExportJobs.expiresAt, cutoff));
  const pendingRows = rows.filter(row => Boolean(row.fileKey));
  const removableRows = rows.filter(row => !row.fileKey);
  if (removableRows.length) await db.delete(filteredStoryExportJobs).where(inArray(filteredStoryExportJobs.id, removableRows.map(row => row.id)));
  if (pendingRows.length) await db.update(filteredStoryExportJobs).set({ status: "expired", fileDeletePending: true, leaseOwner: null, leaseExpiresAt: null }).where(inArray(filteredStoryExportJobs.id, pendingRows.map(row => row.id)));
  return { success: true as const, deletedJobs: removableRows.length, deletedFiles: 0, pendingFiles: pendingRows.length };
}

export async function recoverOrphanedExportJobs(limit = 5) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const now = new Date();
  const candidates = await db.select({ id: filteredStoryExportJobs.id, ownerOpenId: filteredStoryExportJobs.createdByOpenId, recoveryAttempts: filteredStoryExportJobs.recoveryAttempts, fileKey: filteredStoryExportJobs.fileKey }).from(filteredStoryExportJobs).where(or(eq(filteredStoryExportJobs.status, "queued"), and(eq(filteredStoryExportJobs.status, "processing"), staleLeaseCondition(now)))).limit(Math.min(20, Math.max(1, limit)));
  let recovered = 0;
  for (const candidate of candidates) {
    if (Number(candidate.recoveryAttempts ?? 0) >= MAX_RECOVERY_ATTEMPTS) {
      await db.update(filteredStoryExportJobs).set({ status: "failed", progress: 100, errorMessage: "Job excedeu o limite de tentativas de recuperação.", fileDeletePending: Boolean(candidate.fileKey), leaseOwner: null, leaseExpiresAt: null }).where(eq(filteredStoryExportJobs.id, candidate.id));
      continue;
    }
    if (await processPersistentExportJob(candidate.id, candidate.ownerOpenId, true)) recovered += 1;
  }
  return { success: true as const, recovered, skipped: Math.max(0, candidates.length - recovered) };
}

export type ExportJobsMetrics = {
  windowHours: number;
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  expired: number;
  expiredLeases: number;
  recoveryExhausted: number;
  orphaned: number;
  fileDeletePending: number;
  fileDeletePendingPrevious: number;
  fileDeletePendingGrowth: number;
};

export async function listPendingFileDeleteQueue(limit = 20) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const rows = await db.select({ id: filteredStoryExportJobs.id, fileKey: filteredStoryExportJobs.fileKey, expiresAt: filteredStoryExportJobs.expiresAt }).from(filteredStoryExportJobs).where(eq(filteredStoryExportJobs.fileDeletePending, true)).limit(Math.min(50, Math.max(1, limit)));
  return rows.map(row => ({ jobId: row.id, hasFile: Boolean(row.fileKey), expiresAt: row.expiresAt.toISOString() }));
}

export async function getExportJobsMetrics(windowHours = 24): Promise<ExportJobsMetrics> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const hours = Math.min(720, Math.max(1, Math.trunc(windowHours)));
  const now = Date.now();
  const periodStart = now - hours * 60 * 60 * 1000;
  const extendedCutoff = new Date(periodStart - hours * 60 * 60 * 1000);
  const rows = await db.select({ status: filteredStoryExportJobs.status, leaseExpiresAt: filteredStoryExportJobs.leaseExpiresAt, recoveryAttempts: filteredStoryExportJobs.recoveryAttempts, fileDeletePending: filteredStoryExportJobs.fileDeletePending, createdAt: filteredStoryExportJobs.createdAt }).from(filteredStoryExportJobs).where(sql`${filteredStoryExportJobs.createdAt} >= ${extendedCutoff}`).limit(5000);
  const metrics: ExportJobsMetrics = { windowHours: hours, total: 0, queued: 0, processing: 0, completed: 0, failed: 0, cancelled: 0, expired: 0, expiredLeases: 0, recoveryExhausted: 0, orphaned: 0, fileDeletePending: 0, fileDeletePendingPrevious: 0, fileDeletePendingGrowth: 0 };
  for (const row of rows) {
    const isCurrentWindow = row.createdAt.getTime() >= periodStart;
    if (isCurrentWindow) {
      metrics.total += 1;
      const status = row.status as PersistentExportStatus;
      if (status in metrics) metrics[status] += 1;
      if (row.fileDeletePending) metrics.fileDeletePending += 1;
      if (status === "processing" && row.leaseExpiresAt && row.leaseExpiresAt.getTime() < now) metrics.expiredLeases += 1;
      if ((status === "queued" || status === "processing") && row.createdAt.getTime() < now - LEASE_MS * 2) metrics.orphaned += 1;
      if (Number(row.recoveryAttempts ?? 0) >= MAX_RECOVERY_ATTEMPTS) metrics.recoveryExhausted += 1;
    } else if (row.fileDeletePending) {
      metrics.fileDeletePendingPrevious += 1;
    }
  }
  metrics.fileDeletePendingGrowth = metrics.fileDeletePending - metrics.fileDeletePendingPrevious;
  return metrics;
}

export type ExportAlertEnvironment = "development" | "preview" | "production";
export type ExportAlertSettings = {
  environment: ExportAlertEnvironment;
  severity: "INFO" | "WARNING" | "CRITICAL";
  growthThreshold: number;
  minimumQueueSize: number;
  consecutiveWindows: number;
};

const DEFAULT_EXPORT_ALERT_SETTINGS: Omit<ExportAlertSettings, "environment"> = {
  severity: "WARNING",
  growthThreshold: 3,
  minimumQueueSize: 5,
  consecutiveWindows: 1,
};

function exportAlertSettingsKey(environment: ExportAlertEnvironment) {
  return `export_jobs_alert_settings_${environment}`;
}

export async function getExportJobsAlertSettings(environment: ExportAlertEnvironment): Promise<ExportAlertSettings> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, exportAlertSettingsKey(environment))).limit(1);
  try {
    const parsed = row?.value ? JSON.parse(row.value) as Partial<ExportAlertSettings> : {};
    return {
      environment,
      severity: parsed.severity === "INFO" || parsed.severity === "CRITICAL" ? parsed.severity : DEFAULT_EXPORT_ALERT_SETTINGS.severity,
      growthThreshold: Number.isInteger(parsed.growthThreshold) ? Math.min(100000, Math.max(1, Number(parsed.growthThreshold))) : DEFAULT_EXPORT_ALERT_SETTINGS.growthThreshold,
      minimumQueueSize: Number.isInteger(parsed.minimumQueueSize) ? Math.min(100000, Math.max(0, Number(parsed.minimumQueueSize))) : DEFAULT_EXPORT_ALERT_SETTINGS.minimumQueueSize,
      consecutiveWindows: Number.isInteger(parsed.consecutiveWindows) ? Math.min(10, Math.max(1, Number(parsed.consecutiveWindows))) : DEFAULT_EXPORT_ALERT_SETTINGS.consecutiveWindows,
    };
  } catch {
    return { environment, ...DEFAULT_EXPORT_ALERT_SETTINGS };
  }
}

export async function updateExportJobsAlertSettings(input: Omit<ExportAlertSettings, "environment"> & { environment: ExportAlertEnvironment; changedByOpenId?: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const settings = await getExportJobsAlertSettings(input.environment);
  const next: ExportAlertSettings = {
    environment: input.environment,
    severity: input.severity,
    growthThreshold: Math.min(100000, Math.max(1, Math.trunc(input.growthThreshold))),
    minimumQueueSize: Math.min(100000, Math.max(0, Math.trunc(input.minimumQueueSize))),
    consecutiveWindows: Math.min(10, Math.max(1, Math.trunc(input.consecutiveWindows))),
  };
  await db.insert(appSettings).values({ key: exportAlertSettingsKey(input.environment), value: JSON.stringify({ ...settings, ...next }) }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(next), updatedAt: new Date() } });
  await db.insert(exportJobsAlertSettingsAudit).values({ environment: input.environment, previousValue: JSON.stringify(settings), nextValue: JSON.stringify(next), changedByOpenId: (input.changedByOpenId ?? "system").slice(0, 160), changedAt: new Date() });
  return next;
}

export async function listExportJobsAlertSettingsHistory(input: { environment: ExportAlertEnvironment; offset?: number; limit?: number; ownerOpenId?: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const rows = await db.select().from(exportJobsAlertSettingsAudit).where(eq(exportJobsAlertSettingsAudit.environment, input.environment)).orderBy(desc(exportJobsAlertSettingsAudit.changedAt)).limit(limit).offset(offset);
  const auditRows = rows.filter(row => row.environment === input.environment && row.changedAt instanceof Date && typeof row.previousValue === "string" && typeof row.nextValue === "string" && typeof row.changedByOpenId === "string");
  const items = auditRows.map(row => ({ id: String(row.id), environment: row.environment as ExportAlertEnvironment, previousValue: row.previousValue, nextValue: row.nextValue, changedByOpenId: row.changedByOpenId, changedAt: row.changedAt.toISOString() }));
  return { items, offset, limit, hasNextPage: items.length === limit };
}

export async function getExportJobsMetricsTrend(windowDays = 30) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const days = Math.min(90, Math.max(1, Math.trunc(windowDays)));
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await db.select({ createdAt: filteredStoryExportJobs.createdAt, leaseExpiresAt: filteredStoryExportJobs.leaseExpiresAt, status: filteredStoryExportJobs.status, fileDeletePending: filteredStoryExportJobs.fileDeletePending }).from(filteredStoryExportJobs).where(sql`${filteredStoryExportJobs.createdAt} >= ${cutoff}`).limit(10000);
  const buckets = new Map<string, { pendingDelete: number; expiredLeases: number }>();
  for (let index = 0; index < days; index += 1) {
    const bucket = new Date(cutoff.getTime() + index * 24 * 60 * 60 * 1000);
    buckets.set(bucket.toISOString().slice(0, 10), { pendingDelete: 0, expiredLeases: 0 });
  }
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (row.fileDeletePending) bucket.pendingDelete += 1;
    if (row.status === "processing" && row.leaseExpiresAt && row.leaseExpiresAt.getTime() < now.getTime()) bucket.expiredLeases += 1;
  }
  return { windowDays: days, points: Array.from(buckets.entries()).map(([date, values]) => ({ bucketStart: `${date}T00:00:00.000Z`, ...values })) };
}

export async function getExportJobAlertDetail(alertId: string, _ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const numericId = Number(alertId);
  if (!Number.isInteger(numericId) || numericId <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Alerta inválido." });
  const [alert] = await db.select().from(operationalAlerts).where(eq(operationalAlerts.id, numericId)).limit(1);
  if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: "Alerta não encontrado." });
  const rows = await db.select().from(filteredStoryExportJobs).where(or(eq(filteredStoryExportJobs.fileDeletePending, true), inArray(filteredStoryExportJobs.status, ["queued", "processing", "failed"]))).limit(100);
  const affectedJobs = rows.map(row => ({ jobId: row.id, status: String(row.status), recoveryAttempts: Number(row.recoveryAttempts ?? 0), leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null, fileDeletePending: Boolean(row.fileDeletePending) }));
  const timeline = rows.flatMap(row => [
    { event: "created" as const, occurredAt: row.createdAt.toISOString(), jobId: row.id, message: "Job de exportação criado." },
    ...(row.lastRecoveredAt ? [{ event: "recovered" as const, occurredAt: row.lastRecoveredAt.toISOString(), jobId: row.id, message: "Job recuperado por lease." }] : []),
    ...(row.fileDeletePending ? [{ event: "file_delete_pending" as const, occurredAt: row.updatedAt.toISOString(), jobId: row.id, message: "Arquivo aguardando deleção oficial." }] : []),
  ]).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return {
    alert: { id: String(alert.id), type: alert.alertType, severity: alert.severity, message: alert.message, createdAt: alert.createdAt.toISOString(), resolvedAt: alert.isResolved ? alert.updatedAt.toISOString() : null },
    affectedJobs,
    timeline: [{ event: "created" as const, occurredAt: alert.createdAt.toISOString(), jobId: null, message: alert.title }, ...timeline].slice(0, 200),
  };
}

export async function getExportJobsTrendBucket(input: { from: string; to: string; ownerOpenId?: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) throw new TRPCError({ code: "BAD_REQUEST", message: "Intervalo temporal inválido." });
  const jobRows = await db.select({ id: filteredStoryExportJobs.id, status: filteredStoryExportJobs.status, recoveryAttempts: filteredStoryExportJobs.recoveryAttempts, leaseExpiresAt: filteredStoryExportJobs.leaseExpiresAt, fileDeletePending: filteredStoryExportJobs.fileDeletePending, createdAt: filteredStoryExportJobs.createdAt }).from(filteredStoryExportJobs).where(and(gte(filteredStoryExportJobs.createdAt, from), lt(filteredStoryExportJobs.createdAt, to), input.ownerOpenId ? eq(filteredStoryExportJobs.createdByOpenId, input.ownerOpenId) : sql`1=1`)).limit(100);
  const alertRows = await db.select({ id: operationalAlerts.id, alertType: operationalAlerts.alertType, severity: operationalAlerts.severity, title: operationalAlerts.title, message: operationalAlerts.message, isResolved: operationalAlerts.isResolved, createdAt: operationalAlerts.createdAt, updatedAt: operationalAlerts.updatedAt }).from(operationalAlerts).where(and(gte(operationalAlerts.createdAt, from), lt(operationalAlerts.createdAt, to))).limit(100);
  return { from: from.toISOString(), to: to.toISOString(), jobs: jobRows.map(row => ({ jobId: row.id, status: String(row.status), recoveryAttempts: Number(row.recoveryAttempts ?? 0), leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null, fileDeletePending: Boolean(row.fileDeletePending) })), alerts: alertRows.map(row => ({ id: String(row.id), alertType: row.alertType, severity: row.severity, title: row.title, message: row.message, isResolved: row.isResolved === 1, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })) };
}

export async function getExportJobsAlertEfficiency(input: { windowDays?: number; ownerOpenId?: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const days = Math.min(90, Math.max(1, Math.trunc(input.windowDays ?? 30)));
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.select({ isResolved: operationalAlerts.isResolved, createdAt: operationalAlerts.createdAt, updatedAt: operationalAlerts.updatedAt }).from(operationalAlerts).where(gte(operationalAlerts.createdAt, start)).limit(5000);
  const total = rows.length;
  const resolved = rows.filter(row => row.isResolved === 1).length;
  const ages = rows.map(row => Math.max(0, (row.isResolved === 1 ? row.updatedAt : new Date()).getTime() - row.createdAt.getTime()));
  return { windowDays: days, total, resolved, resolutionRate: total ? resolved / total : 0, averageAgeMs: ages.length ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length) : 0, openCount: total - resolved };
}

export async function evaluateExportJobsOperationalAlerts(windowHours = 24) {
  const metrics = await getExportJobsMetrics(windowHours);
  const alerts: string[] = [];
  if (metrics.expiredLeases >= 3) {
    await recordOperationalAlert({ integration: "pipeline", alertType: "export_job_lease_expired", severity: "WARNING", title: "Leases de exportação expiradas", message: "Exportações possuem leases expiradas repetidamente; revisar recuperação do Autoscale." });
    alerts.push("export_job_lease_expired");
  }
  if (metrics.recoveryExhausted > 0) {
    await recordOperationalAlert({ integration: "pipeline", alertType: "export_job_recovery_exhausted", severity: "CRITICAL", title: "Recuperação de exportação esgotada", message: "Uma ou mais exportações atingiram o limite máximo de tentativas de recuperação." });
    alerts.push("export_job_recovery_exhausted");
  }
  if (metrics.orphaned > 0) {
    await recordOperationalAlert({ integration: "pipeline", alertType: "export_job_orphaned", severity: "WARNING", title: "Jobs de exportação órfãos", message: "Há exportações presas em fila ou processamento além da validade esperada." });
    alerts.push("export_job_orphaned");
  }
  if (metrics.fileDeletePending > 0) {
    await recordOperationalAlert({ integration: "pipeline", alertType: "export_file_delete_pending", severity: "INFO", title: "Arquivos aguardando deleção oficial", message: "Existem arquivos de exportação marcados como fileDeletePending aguardando a API oficial do storage." });
    alerts.push("export_file_delete_pending");
  }
  const settings = await getExportJobsAlertSettings((process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "preview" ? "preview" : "development"));
  if (metrics.fileDeletePending >= settings.minimumQueueSize && metrics.fileDeletePendingGrowth >= settings.growthThreshold) {
    await recordOperationalAlert({ integration: "pipeline", alertType: "export_file_delete_queue_growth", severity: settings.severity, title: "Crescimento anômalo da fila de deleção", message: "A fila fileDeletePending cresceu de forma contínua acima do limite operacional; revisar a integração de deleção do storage." });
    alerts.push("export_file_delete_queue_growth");
  }
  return { metrics, alerts };
}

export async function listExportHistory(filters: ExportHistoryFilters) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const conditions = [eq(filteredStoryExportJobs.createdByOpenId, filters.ownerOpenId)];
  if (filters.format) conditions.push(eq(filteredStoryExportJobs.format, filters.format));
  if (filters.status) conditions.push(eq(filteredStoryExportJobs.status, filters.status));
  if (filters.from) conditions.push(sql`${filteredStoryExportJobs.createdAt} >= ${new Date(`${filters.from}T00:00:00.000Z`)}`);
  if (filters.to) conditions.push(sql`${filteredStoryExportJobs.createdAt} <= ${new Date(`${filters.to}T23:59:59.999Z`)}`);
  const where = and(...conditions);
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(filteredStoryExportJobs).where(where);
  const rows = await db.select().from(filteredStoryExportJobs).where(where).orderBy(desc(filteredStoryExportJobs.createdAt)).limit(limit).offset(offset);
  const items = rows.map(toPublicJob).map((item, index) => ({ ...item, createdAt: rows[index]?.createdAt.toISOString() ?? "", updatedAt: rows[index]?.updatedAt.toISOString() ?? "", format: rows[index]?.format ?? "csv" }));
  return { items, total: Number(countRow?.count ?? 0), offset, limit, nextOffset: offset + items.length < Number(countRow?.count ?? 0) ? offset + items.length : null, hasNextPage: offset + items.length < Number(countRow?.count ?? 0) };
}

export function resetFilteredStoriesExportJobsForTest() {}
