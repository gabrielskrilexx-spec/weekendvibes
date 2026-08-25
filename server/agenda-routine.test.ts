import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { AGENDA_ROUTINE_COMPOSITION, normalizeTrackedStepResultForTest, runFullAgendaRoutine, runInstagramAgendaStep, runPublicAgendaStep, runScheduledWithRetriesForTest, isRetryableAgendaErrorForTest } from "./agenda-routine";

describe("agenda routine composition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normaliza o resultado aninhado da fonte pública para persistência operacional", () => {
    expect(normalizeTrackedStepResultForTest({ archived: 0, result: { read: 60, filtered: 58, persisted: 1, duplicates: 1 } })).toEqual({ read: 60, filtered: 58, persisted: 1, duplicates: 1 });
    expect(normalizeTrackedStepResultForTest({ read: 3, filtered: 2, persisted: 1 })).toEqual({ read: 3, filtered: 2, persisted: 1 });
  });

  it("compõe o fluxo completo manual com arquivamento único e as duas fontes", async () => {
    const result = await runFullAgendaRoutine({ trigger: "manual" });
    expect(result).toEqual(expect.objectContaining({ archived: 4, publicSources: { imported: 2 }, instagram: { imported: 1 }, status: "succeeded", errors: [], automationSummary: expect.objectContaining({ routine: "full-agenda", status: "succeeded", added: 3 }) }));
    expect(mocks.archiveExpiredSoldOutEvents).toHaveBeenCalledTimes(1);
    expect(mocks.runIngestionPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.runInstagramPipeline).toHaveBeenCalledTimes(1);
  });

  it("mantém as pernas pública e Instagram disponíveis para os callbacks agendados", async () => {
    await runPublicAgendaStep();
    await runInstagramAgendaStep();
    expect(mocks.archiveExpiredSoldOutEvents).toHaveBeenCalledTimes(2);
    expect(mocks.runIngestionPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.runInstagramPipeline).toHaveBeenCalledTimes(1);
    expect(AGENDA_ROUTINE_COMPOSITION).toEqual(["archiveExpiredSoldOutEvents", "runIngestionPipeline", "runInstagramPipeline"]);
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

  it("não repete erro 4xx nem execução manual", async () => {
    expect(isRetryableAgendaErrorForTest(Object.assign(new Error("permission denied"), { status: 403 }))).toBe(false);
    const state = { history: [] as Array<{ attempt: number; startedAt: string; failedAt: string; reason: string; httpStatus: number | null }> };
    await expect(runScheduledWithRetriesForTest(async () => { throw new Error("network timeout"); }, false, state, 0)).rejects.toThrow("network timeout");
    expect(state.history).toHaveLength(0);
  });
});
