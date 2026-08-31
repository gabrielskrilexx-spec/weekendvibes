import { beforeEach, describe, expect, it, vi } from "vitest";

const records = new Map<string, Record<string, unknown>>();
const fakeDb = {
  insert: () => ({ values(value: Record<string, unknown>) { records.set(String(value.id ?? value.key), value); return { onDuplicateKeyUpdate: async () => undefined }; } }),
  select: () => ({ from() { return this; }, where() { return this; }, orderBy() { return this; }, offset() { return this; }, limit() { return this; }, then(resolve: (rows: Record<string, unknown>[]) => unknown) { return Promise.resolve(Array.from(records.values())).then(resolve); } }),
  update: () => ({ set(patch: Record<string, unknown>) { return { where: async () => { for (const [id, row] of records) records.set(id, { ...row, ...patch }); return { affectedRows: 1 }; } }; } }),
  delete: () => ({ where: async () => { records.clear(); } }),
};

const { recordOperationalAlertMock } = vi.hoisted(() => ({ recordOperationalAlertMock: vi.fn(async () => undefined) }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => fakeDb), recordOperationalAlert: recordOperationalAlertMock }));
vi.mock("./storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` })), storageGet: vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` })) }));
vi.mock("./ingestion-reports", () => ({
  listAllFilteredStories: vi.fn(),
  buildFilteredStoriesCsv: vi.fn((stories: unknown[]) => `csv:${stories.length}`),
}));

import { buildFilteredStoriesCsv, listAllFilteredStories } from "./ingestion-reports";
import { cancelPersistentExportJob, createPersistentExportJob, getPersistentExportDownload, getPersistentExportJobStatus, listExportHistory, purgePersistentExportJobs, recoverOrphanedExportJobs, listPendingFileDeleteQueue, getExportJobsMetrics, evaluateExportJobsOperationalAlerts, getExportJobsMetricsTrend, getExportJobsAlertSettings, updateExportJobsAlertSettings, getExportJobsTrendBucket, getExportJobsAlertEfficiency, getExportJobsAlertEfficiencyTrend, listExportJobsAlertSettingsHistory } from "./filtered-story-export-jobs";

describe("persistent filtered stories export jobs", () => {
  beforeEach(() => {
    records.clear();
    vi.mocked(listAllFilteredStories).mockReset();
    vi.mocked(buildFilteredStoriesCsv).mockClear();
    recordOperationalAlertMock.mockClear();
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

  it("contabiliza fila pendente e métricas de recuperação sem expor chaves do storage", async () => {
    await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const job = await createPersistentExportJob({ format: "csv", filters: {}, createdByOpenId: "admin-open-id" });
    const record = records.get(job.jobId)!;
    record.fileDeletePending = true;
    record.fileKey = "exports/pending.csv";
    record.status = "processing";
    record.leaseExpiresAt = new Date("2020-01-01T00:00:00.000Z");
    record.createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const queue = await listPendingFileDeleteQueue(20);
    const metrics = await getExportJobsMetrics(24 * 720);
    expect(queue).toEqual(expect.arrayContaining([expect.objectContaining({ jobId: job.jobId, hasFile: true })]));
    expect(metrics.fileDeletePending).toBe(1);
    expect(metrics.expiredLeases).toBe(1);
  });

  it("dispara alertas operacionais com mensagens estáveis para deduplicação", async () => {
    const jobs = await Promise.all(Array.from({ length: 3 }, () => createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" })));
    await new Promise(resolve => setTimeout(resolve, 20));
    for (const job of jobs) {
      const record = records.get(job.jobId)!;
      record.status = "processing";
      record.createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
      record.leaseExpiresAt = new Date("2020-01-01T00:00:00.000Z");
      record.recoveryAttempts = 3;
      record.fileDeletePending = true;
    }
    await evaluateExportJobsOperationalAlerts(24 * 720);
    expect(recordOperationalAlertMock).toHaveBeenCalledWith(expect.objectContaining({ alertType: "export_job_recovery_exhausted", severity: "CRITICAL" }));
    expect(recordOperationalAlertMock).toHaveBeenCalledWith(expect.objectContaining({ alertType: "export_job_lease_expired" }));
    expect(recordOperationalAlertMock).toHaveBeenCalledWith(expect.objectContaining({ alertType: "export_file_delete_pending" }));
  });

  it("dispara alerta deduplicável quando a fila pendente cresce acima da janela anterior", async () => {
    vi.mocked(listAllFilteredStories).mockResolvedValue([]);
    const jobs = await Promise.all(Array.from({ length: 5 }, () => createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" })));
    for (const job of jobs) {
      const record = records.get(job.jobId)!;
      record.status = "completed";
      record.fileDeletePending = true;
      record.createdAt = new Date();
    }
    const result = await evaluateExportJobsOperationalAlerts(24);
    expect(result.metrics.fileDeletePending).toBe(5);
    expect(result.metrics.fileDeletePendingPrevious).toBe(0);
    expect(result.metrics.fileDeletePendingGrowth).toBe(5);
    expect(result.alerts).toContain("export_file_delete_queue_growth");
    expect(recordOperationalAlertMock).toHaveBeenCalledWith(expect.objectContaining({ alertType: "export_file_delete_queue_growth", severity: "WARNING" }));
  });

  it("calcula pontos diários de fila pendente e leases expiradas", async () => {
    const job = await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const record = records.get(job.jobId)!;
    record.createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    record.status = "processing";
    record.fileDeletePending = true;
    record.leaseExpiresAt = new Date("2020-01-01T00:00:00.000Z");
    const trend = await getExportJobsMetricsTrend(7);
    expect(trend.points).toHaveLength(7);
    expect(trend.points.some(point => point.pendingDelete === 1 && point.expiredLeases === 1)).toBe(true);
  });

  it("normaliza e persiste limiares por ambiente sem expor estado complexo", async () => {
    const defaults = await getExportJobsAlertSettings("preview");
    expect(defaults).toMatchObject({ environment: "preview", severity: "WARNING", growthThreshold: 3, minimumQueueSize: 5 });
    const updated = await updateExportJobsAlertSettings({ environment: "preview", severity: "CRITICAL", growthThreshold: 8, minimumQueueSize: 12, consecutiveWindows: 2 });
    expect(updated).toEqual({ environment: "preview", severity: "CRITICAL", growthThreshold: 8, minimumQueueSize: 12, consecutiveWindows: 2 });
  });

  it("lista jobs com metadados sanitizados para o histórico", async () => {
    await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const history = await listExportHistory({ ownerOpenId: "admin-open-id", limit: 20, offset: 0 });
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({ format: "json", fileDeletePending: false });
  });

  it("recorta jobs no intervalo temporal do bucket e mantém payload primitivo", async () => {
    const job = await createPersistentExportJob({ format: "json", filters: {}, createdByOpenId: "admin-open-id" });
    const row = records.get(job.jobId)!;
    row.createdAt = new Date("2026-08-20T12:00:00.000Z");
    row.status = "processing";
    row.recoveryAttempts = 2;
    const bucket = await getExportJobsTrendBucket({ from: "2026-08-20T00:00:00.000Z", to: "2026-08-21T00:00:00.000Z", ownerOpenId: "admin-open-id" });
    expect(bucket.jobs).toEqual([expect.objectContaining({ jobId: job.jobId, recoveryAttempts: 2 })]);
    expect(bucket.from).toBe("2026-08-20T00:00:00.000Z");
  });

  it("calcula taxa de resolução e idade média com saída estável", async () => {
    const efficiency = await getExportJobsAlertEfficiency({ windowDays: 30, ownerOpenId: "admin-open-id" });
    expect(efficiency).toMatchObject({ windowDays: 30, total: 0, resolved: 0, resolutionRate: 0, averageAgeMs: 0, openCount: 0 });
  });

  it("calcula série diária de eficiência com buckets estáveis para drill-down", async () => {
    const trend = await getExportJobsAlertEfficiencyTrend(7);
    expect(trend.windowDays).toBe(7);
    expect(trend.points).toHaveLength(7);
    expect(trend.points[0]).toMatchObject({ total: 0, resolved: 0, resolutionRate: 0, averageAgeMs: 0 });
  });

  it("registra histórico append-only da alteração de configuração com openId e timestamp ISO", async () => {
    await updateExportJobsAlertSettings({ environment: "preview", severity: "CRITICAL", growthThreshold: 9, minimumQueueSize: 11, consecutiveWindows: 2, changedByOpenId: "admin-open-id" });
    const history = await listExportJobsAlertSettingsHistory({ environment: "preview", offset: 0, limit: 10, ownerOpenId: "admin-open-id" });
    expect(history.items[0]).toMatchObject({ environment: "preview", changedByOpenId: "admin-open-id" });
    expect(history.items[0]?.changedAt).toMatch(/Z$/);
  });
});
