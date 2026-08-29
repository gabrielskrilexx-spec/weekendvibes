import { beforeEach, describe, expect, it, vi } from "vitest";

const records = new Map<string, Record<string, unknown>>();
const fakeDb = {
  insert: () => ({ values: async (value: Record<string, unknown>) => { records.set(String(value.id), value); } }),
  select: () => ({ from() { return this; }, where() { return this; }, orderBy() { return this; }, offset() { return this; }, limit() { return this; }, then(resolve: (rows: Record<string, unknown>[]) => unknown) { return Promise.resolve(Array.from(records.values())).then(resolve); } }),
  update: () => ({ set(patch: Record<string, unknown>) { return { where: async () => { for (const [id, row] of records) records.set(id, { ...row, ...patch }); return { affectedRows: 1 }; } }; } }),
  delete: () => ({ where: async () => { records.clear(); } }),
};

vi.mock("./db", () => ({ getDb: vi.fn(async () => fakeDb) }));
vi.mock("./storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` })), storageGet: vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` })) }));
vi.mock("./ingestion-reports", () => ({
  listAllFilteredStories: vi.fn(),
  buildFilteredStoriesCsv: vi.fn((stories: unknown[]) => `csv:${stories.length}`),
}));

import { buildFilteredStoriesCsv, listAllFilteredStories } from "./ingestion-reports";
import { cancelPersistentExportJob, createPersistentExportJob, getPersistentExportDownload, getPersistentExportJobStatus, listExportHistory, purgePersistentExportJobs, recoverOrphanedExportJobs } from "./filtered-story-export-jobs";

describe("persistent filtered stories export jobs", () => {
  beforeEach(() => {
    records.clear();
    vi.mocked(listAllFilteredStories).mockReset();
    vi.mocked(buildFilteredStoriesCsv).mockClear();
  });

  it("persiste filtros, processa o arquivo e expõe somente metadados no status", async () => {
    vi.mocked(listAllFilteredStories).mockImplementation(async filters => [{ id: filters.username ?? "sem-fonte" } as never]);
    const job = await createPersistentExportJob({ format: "csv", filters: { username: "alpha", sort: [{ column: "source", direction: "asc" }] }, createdByOpenId: "admin-open-id" });
    expect(job.status).toBe("queued");
    expect(JSON.parse(String(records.get(job.jobId)?.filtersJson))).toMatchObject({ username: "alpha" });
    await new Promise(resolve => setTimeout(resolve, 20));
    const status = await getPersistentExportJobStatus(job.jobId, "admin-open-id");
    expect(status).toMatchObject({ status: "completed", progress: 100, contentType: "text/csv;charset=utf-8", fileDeletePending: false });
    expect(getPersistentExportDownload).toBeTypeOf("function");
    expect(vi.mocked(listAllFilteredStories)).toHaveBeenCalledWith(expect.objectContaining({ username: "alpha" }));
  });

  it("cancela um job queued sem expor download e marca deleção pendente quando há arquivo", async () => {
    vi.mocked(listAllFilteredStories).mockResolvedValue([]);
    const job = await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const cancelled = await cancelPersistentExportJob(job.jobId, "admin-open-id");
    expect(cancelled).toMatchObject({ success: true, status: "cancelled" });
    await new Promise(resolve => setTimeout(resolve, 10));
    await expect(getPersistentExportDownload(job.jobId, "admin-open-id")).rejects.toThrow("ainda não está pronta");
    expect(records.get(job.jobId)?.fileDeletePending).toBe(false);
  });

  it("recupera job processing com lease expirada e grava a tentativa de recuperação", async () => {
    vi.mocked(listAllFilteredStories).mockResolvedValue([]);
    const job = await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    await new Promise(resolve => setTimeout(resolve, 10));
    const record = records.get(job.jobId)!;
    record.status = "processing";
    record.leaseExpiresAt = new Date("2020-01-01T00:00:00.000Z");
    record.recoveryAttempts = 0;
    const result = await recoverOrphanedExportJobs(5);
    expect(result.success).toBe(true);
    expect(Number(records.get(job.jobId)?.recoveryAttempts)).toBeGreaterThanOrEqual(1);
  });

  it("converte job expirado com arquivo em estado expired e fileDeletePending", async () => {
    const job = await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const record = records.get(job.jobId)!;
    record.expiresAt = new Date("2020-01-01T00:00:00.000Z");
    record.fileKey = "exports/old.json";
    record.status = "completed";
    const status = await getPersistentExportJobStatus(job.jobId, "admin-open-id");
    expect(status).toMatchObject({ status: "expired", fileDeletePending: true });
  });

  it("mantém arquivo referenciado como pendência durante a limpeza lógica", async () => {
    const job = await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const record = records.get(job.jobId)!;
    record.expiresAt = new Date("2020-01-01T00:00:00.000Z");
    record.fileKey = "exports/old.json";
    const result = await purgePersistentExportJobs("2021-01-01T00:00:00.000Z");
    expect(result).toMatchObject({ success: true, deletedJobs: 0, deletedFiles: 0, pendingFiles: 1 });
    expect(records.get(job.jobId)?.fileDeletePending).toBe(true);
  });

  it("lista jobs com metadados sanitizados para o histórico", async () => {
    await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const history = await listExportHistory({ ownerOpenId: "admin-open-id", limit: 20, offset: 0 });
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({ format: "json", fileDeletePending: false });
  });
});
