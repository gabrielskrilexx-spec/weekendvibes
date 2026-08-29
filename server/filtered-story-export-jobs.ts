import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  buildFilteredStoriesCsv,
  listAllFilteredStories,
  type FilteredStoriesFilter,
} from "./ingestion-reports";

type ExportFormat = "csv" | "json";
type ExportJobStatus = "queued" | "processing" | "completed" | "failed";

type ExportJob = {
  jobId: string;
  format: ExportFormat;
  filters: FilteredStoriesFilter;
  status: ExportJobStatus;
  progress: number;
  fileName: string | null;
  contentType: string | null;
  content: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

const jobs = new Map<string, ExportJob>();
const JOB_TTL_MS = 10 * 60 * 1000;
const MAX_JOBS = 24;

function purgeExpiredJobs(now = Date.now()) {
  for (const [jobId, job] of Array.from(jobs.entries())) {
    if (now - Date.parse(job.updatedAt) > JOB_TTL_MS) jobs.delete(jobId);
  }
  while (jobs.size > MAX_JOBS) {
    const oldest = Array.from(jobs.values()).sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))[0];
    if (!oldest) break;
    jobs.delete(oldest.jobId);
  }
}

function publicJob(job: ExportJob) {
  return {
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    fileName: job.fileName,
    contentType: job.contentType,
    error: job.error,
  };
}

async function processJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "processing";
  job.progress = 10;
  job.updatedAt = new Date().toISOString();
  try {
    const stories = await listAllFilteredStories(job.filters);
    job.progress = 70;
    job.updatedAt = new Date().toISOString();
    job.content = job.format === "csv" ? buildFilteredStoriesCsv(stories) : JSON.stringify(stories);
    job.fileName = `stories-filtrados-${new Date().toISOString().slice(0, 10)}.${job.format}`;
    job.contentType = job.format === "csv" ? "text/csv;charset=utf-8" : "application/json";
    job.status = "completed";
    job.progress = 100;
    job.error = null;
  } catch {
    job.status = "failed";
    job.progress = 100;
    job.error = "Não foi possível gerar a exportação com os filtros informados.";
  }
  job.updatedAt = new Date().toISOString();
  purgeExpiredJobs();
}

export function createFilteredStoriesExportJob(input: { format: ExportFormat; filters: FilteredStoriesFilter }) {
  purgeExpiredJobs();
  const now = new Date().toISOString();
  const job: ExportJob = {
    jobId: randomUUID(),
    format: input.format,
    filters: { ...input.filters, sort: input.filters.sort?.map(rule => ({ ...rule })) },
    status: "queued",
    progress: 0,
    fileName: null,
    contentType: null,
    content: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(job.jobId, job);
  setTimeout(() => void processJob(job.jobId), 0);
  return { jobId: job.jobId, status: "queued" as const, progress: 0 as const };
}

export function getFilteredStoriesExportJobStatus(jobId: string) {
  purgeExpiredJobs();
  const job = jobs.get(jobId);
  if (!job) return { jobId, status: "failed" as const, progress: 100, fileName: null, contentType: null, error: "Exportação não encontrada ou expirada." };
  return publicJob(job);
}

export function getFilteredStoriesExportDownload(jobId: string) {
  purgeExpiredJobs();
  const job = jobs.get(jobId);
  if (!job || job.status !== "completed" || !job.content || !job.fileName || !job.contentType) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A exportação ainda não está pronta." });
  }
  return { fileName: job.fileName, contentType: job.contentType, content: job.content };
}

export function resetFilteredStoriesExportJobsForTest() {
  jobs.clear();
}
