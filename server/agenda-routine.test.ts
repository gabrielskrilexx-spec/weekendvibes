import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archiveExpiredSoldOutEvents: vi.fn().mockResolvedValue(4),
  runIngestionPipeline: vi.fn().mockResolvedValue({ imported: 2 }),
  runInstagramPipeline: vi.fn().mockResolvedValue({ imported: 1 }),
  startIngestionRun: vi.fn().mockResolvedValue(123),
  finishIngestionRun: vi.fn().mockResolvedValue(undefined),
  processPendingGeocoding: vi.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0, pending: 0 }),
}));

vi.mock("./db", () => ({ archiveExpiredSoldOutEvents: mocks.archiveExpiredSoldOutEvents }));
vi.mock("./ingestion", () => ({ runIngestionPipeline: mocks.runIngestionPipeline }));
vi.mock("./instagram-pipeline", () => ({ runInstagramPipeline: mocks.runInstagramPipeline, isGracefullyDegradedMetaFailure: vi.fn().mockReturnValue(false), getMetaFailureStatus: vi.fn().mockReturnValue(null) }));
vi.mock("./ingestion-reports", () => ({ startIngestionRun: mocks.startIngestionRun, finishIngestionRun: mocks.finishIngestionRun }));
vi.mock("./geocoding", () => ({ processPendingGeocoding: mocks.processPendingGeocoding }));

import { AGENDA_ROUTINE_COMPOSITION, buildAutomationSourceSummariesForTest, normalizeTrackedStepResultForTest, runFullAgendaRoutine, runInstagramAgendaStep, runPublicAgendaStep, runScheduledWithRetriesForTest, isRetryableAgendaErrorForTest, getInstagramAgendaTimeoutMs } from "./agenda-routine";

describe("agenda routine composition", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRITICAL_ALERT_WEBHOOK_URL", ""); });
  afterEach(() => vi.unstubAllEnvs());

  it("normaliza o resultado aninhado da fonte pública para persistência operacional", () => {
    expect(normalizeTrackedStepResultForTest({ archived: 0, result: { read: 60, filtered: 58, persisted: 1, duplicates: 1 } })).toEqual({ read: 60, filtered: 58, persisted: 1, duplicates: 1 });
    expect(normalizeTrackedStepResultForTest({ read: 3, filtered: 2, persisted: 1 })).toEqual({ read: 3, filtered: 2, persisted: 1 });
  });

  it("soma todos os motivos de rejeição no resumo da fonte", () => {
    expect(buildAutomationSourceSummariesForTest([{
      sourceKey: "public",
      result: {
        read: 109,
        persisted: 0,
        sourceReports: [{ sourceKey: "public", read: 109, persistable: 0, rejectionReasons: { past_event: 103, duplicate: 6 } }],
      },
    }])).toEqual([{ sourceKey: "public", read: 109, added: 0, updated: 0, ignored: 109, errors: [] }]);
  });

  it("compõe o fluxo completo manual com arquivamento único e as duas fontes", async () => {
    const result = await runFullAgendaRoutine({ trigger: "manual" });
    expect(result).toEqual(expect.objectContaining({ archived: 4, publicSources: { imported: 2 }, instagram: { imported: 1 }, status: "succeeded", errors: [], automationSummary: expect.objectContaining({ routine: "full-agenda", status: "succeeded", added: 3 }) }));
    expect(mocks.archiveExpiredSoldOutEvents).toHaveBeenCalledTimes(1);
    expect(mocks.runIngestionPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.runInstagramPipeline).toHaveBeenCalledTimes(1);
  });

  it("emite progresso por fase e por fonte durante a rotina completa", async () => {
    const updates: Array<{ phase: string; step: number; sourceKey?: string; sourceStatus?: string }> = [];
    await runFullAgendaRoutine({ trigger: "manual", onProgress: update => updates.push({ phase: update.phase, step: update.step, sourceKey: update.sourceKey, sourceStatus: update.sourceStatus }) });
    expect(updates[0]).toMatchObject({ phase: "starting", step: 0 });
    expect(updates.some(update => update.phase === "archiving" && update.step === 1)).toBe(true);
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey: "public", sourceStatus: "running" }),
      expect.objectContaining({ sourceKey: "public", sourceStatus: "succeeded" }),
      expect.objectContaining({ sourceKey: "instagram", sourceStatus: "running" }),
      expect.objectContaining({ sourceKey: "instagram", sourceStatus: "succeeded" }),
      expect.objectContaining({ phase: "finalizing", step: 3 }),
      expect.objectContaining({ phase: "completed", step: 4 }),
    ]));
  });

  it("mantém as pernas pública e Instagram disponíveis para os callbacks agendados", async () => {
    await runPublicAgendaStep();
    await runInstagramAgendaStep();
    expect(mocks.archiveExpiredSoldOutEvents).toHaveBeenCalledTimes(2);
    expect(mocks.runIngestionPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.runInstagramPipeline).toHaveBeenCalledTimes(1);
    expect(AGENDA_ROUTINE_COMPOSITION).toEqual(["archiveExpiredSoldOutEvents", "runIngestionPipeline", "runInstagramPipeline"]);
  });

  it("converte falha de transporte do Instagram em fallback mock no preview", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.runInstagramPipeline.mockRejectedValueOnce(new Error("ECONNREFUSED: sandbox proxy"));
    const result = await runInstagramAgendaStep({ runId: 987, trigger: "manual" });
    expect(result).toEqual(expect.objectContaining({ previewMock: true, sandboxRestricted: true, status: "SANDBOX_RESTRICTED", imported: 0 }));
    expect(mocks.finishIngestionRun).toHaveBeenCalledWith(987, expect.objectContaining({ status: "succeeded", httpStatus: 200, details: expect.objectContaining({ error: "SANDBOX_RESTRICTED" }) }));
  });

  it("finaliza o run pré-criado pelo ACK manual com trigger manual", async () => {
    await runInstagramAgendaStep({ runId: 987, trigger: "manual" });
    expect(mocks.startIngestionRun).not.toHaveBeenCalled();
    expect(mocks.finishIngestionRun).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ routine: "instagram-agenda", sourceKey: "instagram", details: expect.objectContaining({ trigger: "manual" }) }));
  });

  it("repete falhas temporárias agendadas com backoff progressivo e registra o histórico sanitizado", async () => {
    const state = { history: [] as Array<{ attempt: number; startedAt: string; failedAt: string; reason: string; httpStatus: number | null }> };
    let calls = 0;
    const result = await runScheduledWithRetriesForTest(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error("upstream timeout"), { status: 503 });
      return { ok: true };
    }, true, state, 0);
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(3);
    expect(state.history).toHaveLength(2);
    expect(state.history[0]).toEqual(expect.objectContaining({ attempt: 1, reason: "upstream timeout", httpStatus: 503 }));
    expect(state.history[1]).toEqual(expect.objectContaining({ attempt: 2, httpStatus: 503 }));
  });

  it("limita o timeout da etapa Instagram a uma faixa fail-fast configurável", () => {
    vi.stubEnv("INSTAGRAM_AGENDA_TIMEOUT_MS", "30000");
    expect(getInstagramAgendaTimeoutMs()).toBe(10_000);
    vi.stubEnv("INSTAGRAM_AGENDA_TIMEOUT_MS", "500");
    expect(getInstagramAgendaTimeoutMs()).toBe(1_000);
  });

  it("não repete erro 4xx nem execução manual", async () => {
    expect(isRetryableAgendaErrorForTest(Object.assign(new Error("permission denied"), { status: 403 }))).toBe(false);
    const state = { history: [] as Array<{ attempt: number; startedAt: string; failedAt: string; reason: string; httpStatus: number | null }> };
    await expect(runScheduledWithRetriesForTest(async () => { throw new Error("network timeout"); }, false, state, 0)).rejects.toThrow("network timeout");
    expect(state.history).toHaveLength(0);
  });
});
