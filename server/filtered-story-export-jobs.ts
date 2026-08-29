import { and, eq, inArray, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { filteredStoryExportJobs } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGet, storagePut } from "./storage";
import { buildFilteredStoriesCsv, listAllFilteredStories, type FilteredStoriesFilter } from "./ingestion-reports";

type ExportFormat = "csv" | "json";
type PersistentExportStatus = "queued" | "processing" | "completed" | "failed" | "cancelled" | "expired";
type ExportFilters = FilteredStoriesFilter & { sort?: Array<{ column: "date" | "source" | "status"; direction: "asc" | "desc" }> };

const JOB_TTL_MS = 10 * 60 * 1000;

function toPublicJob(row: typeof filteredStoryExportJobs.$inferSelect) {
  return {
    jobId: row.id,
    status: row.status as PersistentExportStatus,
    progress: Math.min(100, Math.max(0, Number(row.progress))),
    fileName: row.fileName ?? null,
    contentType: row.contentType ?? null,
    error: row.errorMessage ?? null,
  };
}

async function getOwnedJob(jobId: string, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const [row] = await db.select().from(filteredStoryExportJobs).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.createdByOpenId, ownerOpenId))).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Exportação não encontrada." });
  return { db, row };
}

async function processPersistentExportJob(jobId: string, ownerOpenId: string) {
  let owned: Awaited<ReturnType<typeof getOwnedJob>>;
  try {
    owned = await getOwnedJob(jobId, ownerOpenId);
  } catch {
    return;
  }
  const { db } = owned;
  if (owned.row.status !== "queued") return;
  const claimResult = await db.update(filteredStoryExportJobs).set({ status: "processing", progress: 10 }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.createdByOpenId, ownerOpenId), eq(filteredStoryExportJobs.status, "queued")));
  if ((claimResult as { affectedRows?: number }).affectedRows !== 1) return;
  try {
    const [active] = await db.select({ status: filteredStoryExportJobs.status }).from(filteredStoryExportJobs).where(eq(filteredStoryExportJobs.id, jobId)).limit(1);
    if (active?.status === "cancelled") return;
    const filters = JSON.parse(owned.row.filtersJson) as ExportFilters;
    const stories = await listAllFilteredStories(filters);
    await db.update(filteredStoryExportJobs).set({ progress: 70 }).where(eq(filteredStoryExportJobs.id, jobId));
    const content = owned.row.format === "csv" ? buildFilteredStoriesCsv(stories) : JSON.stringify(stories);
    const format = owned.row.format as ExportFormat;
    const fileName = `stories-filtrados-${new Date().toISOString().slice(0, 10)}.${format}`;
    const contentType = format === "csv" ? "text/csv;charset=utf-8" : "application/json";
    const latest = await db.select({ status: filteredStoryExportJobs.status }).from(filteredStoryExportJobs).where(eq(filteredStoryExportJobs.id, jobId)).limit(1);
    if (latest[0]?.status === "cancelled") return;
    const stored = await storagePut(`exports/filtered-stories/${jobId}.${format}`, content, contentType);
    await db.update(filteredStoryExportJobs).set({ status: "completed", progress: 100, fileKey: stored.key, fileName, contentType, completedAt: new Date(), errorMessage: null }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.status, "processing")));
  } catch {
    await db.update(filteredStoryExportJobs).set({ status: "failed", progress: 100, errorMessage: "Não foi possível gerar a exportação com os filtros informados." }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.status, "processing")));
  }
}

export async function createPersistentExportJob(input: { format: ExportFormat; filters: ExportFilters; createdByOpenId: string }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const jobId = randomUUID();
  const now = new Date();
  await db.insert(filteredStoryExportJobs).values({ id: jobId, format: input.format, status: "queued", progress: 0, filtersJson: JSON.stringify(input.filters), createdByOpenId: input.createdByOpenId.slice(0, 160), createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + JOB_TTL_MS) });
  setTimeout(() => void processPersistentExportJob(jobId, input.createdByOpenId.slice(0, 160)), 0);
  return { jobId, status: "queued" as const, progress: 0 as const };
}

export async function getPersistentExportJobStatus(jobId: string, ownerOpenId: string) {
  const { row } = await getOwnedJob(jobId, ownerOpenId);
  if (row.status === "completed" && row.fileKey && row.expiresAt.getTime() <= Date.now()) return { ...toPublicJob(row), status: "expired" as const, progress: 100 };
  return toPublicJob(row);
}

export async function getPersistentExportDownload(jobId: string, ownerOpenId: string) {
  const { row } = await getOwnedJob(jobId, ownerOpenId);
  if (row.status !== "completed" || !row.fileKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A exportação ainda não está pronta." });
  return { fileName: row.fileName ?? `export-${jobId}.json`, contentType: row.contentType ?? "application/octet-stream", downloadUrl: (await storageGet(row.fileKey)).url };
}

export async function cancelPersistentExportJob(jobId: string, ownerOpenId: string) {
  const { db } = await getOwnedJob(jobId, ownerOpenId);
  await db.update(filteredStoryExportJobs).set({ status: "cancelled", progress: 100, cancelledAt: new Date(), errorMessage: "Cancelada pelo administrador." }).where(and(eq(filteredStoryExportJobs.id, jobId), eq(filteredStoryExportJobs.createdByOpenId, ownerOpenId), inArray(filteredStoryExportJobs.status, ["queued", "processing"])));
  return { success: true as const, jobId, status: "cancelled" as const };
}

export async function purgePersistentExportJobs(before?: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const cutoff = before ? new Date(before) : new Date();
  const rows = await db.select({ id: filteredStoryExportJobs.id, fileKey: filteredStoryExportJobs.fileKey }).from(filteredStoryExportJobs).where(lt(filteredStoryExportJobs.expiresAt, cutoff));
  if (rows.length) await db.delete(filteredStoryExportJobs).where(inArray(filteredStoryExportJobs.id, rows.map(row => row.id)));
  return { success: true as const, deletedJobs: rows.length, deletedFiles: rows.filter(row => Boolean(row.fileKey)).length };
}

export function resetFilteredStoriesExportJobsForTest() {}
