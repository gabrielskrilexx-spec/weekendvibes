import { beforeEach, describe, expect, it, vi } from "vitest";

const records = new Map<string, Record<string, unknown>>();
const fakeDb = {
  insert: () => ({ values: async (value: Record<string, unknown>) => { records.set(String(value.id), value); } }),
  select: () => ({ from() { return this; }, where() { return this; }, limit: async () => Array.from(records.values()), then(resolve: (rows: Record<string, unknown>[]) => unknown) { return Promise.resolve(Array.from(records.values())).then(resolve); } }),
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
import { cancelPersistentExportJob, createPersistentExportJob, getPersistentExportDownload, getPersistentExportJobStatus, purgePersistentExportJobs } from "./filtered-story-export-jobs";

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
    expect(status).toMatchObject({ status: "completed", progress: 100, contentType: "text/csv;charset=utf-8" });
    expect(getPersistentExportDownload).toBeTypeOf("function");
    expect(vi.mocked(listAllFilteredStories)).toHaveBeenCalledWith(expect.objectContaining({ username: "alpha" }));
  });

  it("cancela um job queued sem expor download", async () => {
    vi.mocked(listAllFilteredStories).mockResolvedValue([]);
    const job = await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const cancelled = await cancelPersistentExportJob(job.jobId, "admin-open-id");
    expect(cancelled).toMatchObject({ success: true, status: "cancelled" });
    await new Promise(resolve => setTimeout(resolve, 10));
    await expect(getPersistentExportDownload(job.jobId, "admin-open-id")).rejects.toThrow("ainda não está pronta");
  });

  it("remove jobs expirados e contabiliza arquivos referenciados", async () => {
    const job = await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    records.get(job.jobId)!.expiresAt = new Date("2020-01-01T00:00:00.000Z");
    records.get(job.jobId)!.fileKey = "exports/old.json";
    const result = await purgePersistentExportJobs("2021-01-01T00:00:00.000Z");
    expect(result).toEqual({ success: true, deletedJobs: 1, deletedFiles: 1 });
  });
});
