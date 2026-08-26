import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archiveExpiredSoldOutEvents: vi.fn().mockResolvedValue(0),
  runIngestionPipeline: vi.fn().mockResolvedValue({ imported: 2 }),
  runInstagramPipeline: vi.fn().mockResolvedValue({ imported: 1 }),
  listHeartbeatJobs: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
  startIngestionRun: vi.fn().mockResolvedValue(9001),
  finishIngestionRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({ archiveExpiredSoldOutEvents: mocks.archiveExpiredSoldOutEvents, recordOperationalAlert: vi.fn(), getDb: mocks.getDb }));
vi.mock("./ingestion", () => ({ runIngestionPipeline: mocks.runIngestionPipeline }));
vi.mock("./instagram-pipeline", () => ({ InstagramIntegrationFailure: class InstagramIntegrationFailure extends Error {}, runInstagramPipeline: mocks.runInstagramPipeline }));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn() }));
vi.mock("./_core/heartbeat", () => ({ listHeartbeatJobs: mocks.listHeartbeatJobs }));
vi.mock("./ingestion-reports", () => ({ startIngestionRun: mocks.startIngestionRun, finishIngestionRun: mocks.finishIngestionRun }));

import { getNextWednesdayExecution, getWednesdayRoutineStatus, runWednesdayRoutineNow } from "./manual-ingestion";

describe("manual Wednesday routine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listHeartbeatJobs.mockResolvedValue({ total: 1, actorUserId: "owner", jobs: [{ taskUid: "runtime-uid", name: "qualquer nome", description: "Agenda semanal", cronExpression: "0 0 10 * * 3", isEnable: true, timezone: "America/Sao_Paulo", runMode: "full_auto", nextExecutionAt: "2026-08-19T13:00:00.000Z", lastExecutedAt: "2026-08-12T15:04:27.093Z" }] });
  });
  it("calcula a próxima quarta às 10h no fuso de São Paulo", async () => {
    expect(getNextWednesdayExecution(new Date("2026-08-12T15:00:00.000Z"))).toBe("2026-08-19T13:00:00.000Z");
    const status = await getWednesdayRoutineStatus(new Date("2026-08-12T15:00:00.000Z"));
    expect(status.cron).toBe("0 0 10 * * 3");
    expect(status.timezone).toBe("America/Sao_Paulo");
    expect(status.runMode).toBe("full_auto");
    expect(status.nextExecutionAt).toBe("2026-08-19T13:00:00.000Z");
    expect(status.lastExecutedAt).toBe("2026-08-12T15:04:27.093Z");
    expect(status.source).toBe("heartbeat");
  });
  it("retorna metadata indisponível quando nenhum job estruturado corresponde à rotina", async () => {
    mocks.listHeartbeatJobs.mockResolvedValue({ total: 1, actorUserId: "owner", jobs: [{ cronExpression: "0 0 10 * * 3", isEnable: true, timezone: "America/Sao_Paulo", runMode: "manual" }] });
    const status = await getWednesdayRoutineStatus();
    expect(status.source).toBe("metadata-unavailable");
    expect(status.nextExecutionAt).toBeNull();
    expect(status.runMode).toBeNull();
  });

  it("compartilha a execução em andamento e não dispara duas coletas", async () => {
    const first = runWednesdayRoutineNow();
    const second = runWednesdayRoutineNow();
    expect(first).toBe(second);
    await first;
    expect(mocks.archiveExpiredSoldOutEvents).toHaveBeenCalledTimes(1);
    expect(mocks.runIngestionPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.runInstagramPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.archiveExpiredSoldOutEvents.mock.invocationCallOrder[0]).toBeLessThan(mocks.runIngestionPipeline.mock.invocationCallOrder[0]);
    expect(mocks.runIngestionPipeline.mock.invocationCallOrder[0]).toBeLessThan(mocks.runInstagramPipeline.mock.invocationCallOrder[0]);
  });

  it("expõe progresso consultável durante a execução manual e marca a conclusão", async () => {
    mocks.archiveExpiredSoldOutEvents.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(0), 20)));
    const running = runWednesdayRoutineNow();
    await new Promise(resolve => setTimeout(resolve, 0));
    const during = await getWednesdayRoutineStatus();
    expect(during.isRunning).toBe(true);
    expect(during.progress.isRunning).toBe(true);
    expect(during.progress.phase).toBe("archiving");
    expect(during.progress.totalSteps).toBe(4);
    await running;
    const after = await getWednesdayRoutineStatus();
    expect(after.isRunning).toBe(false);
    expect(after.progress.isRunning).toBe(false);
    expect(after.progress.step).toBe(4);
    expect(after.progress.phase).toBe("completed");
  });

  it("persiste um ingestionRuns manual com trigger e metadados agregados", async () => {
    mocks.runInstagramPipeline.mockResolvedValue({ persisted: 3, receivedPosts: 7, structuredEvents: 3, persistedEventIds: [11, 12, 13], dateFilterValidation: { referenceDate: "2026-08-20", allEventsOnOrAfterReference: true } });
    const result = await runWednesdayRoutineNow();
    expect(result.instagram).toMatchObject({ persisted: 3 });
    expect(mocks.startIngestionRun).toHaveBeenCalledWith({ routine: "manual-agenda", sourceKey: "manual" });
    expect(mocks.finishIngestionRun).toHaveBeenCalledWith(9001, expect.objectContaining({
      routine: "manual-agenda",
      sourceKey: "manual",
      status: "succeeded",
      importedCount: 5,
      details: expect.objectContaining({ trigger: "manual", instagram: expect.objectContaining({ persistedEventIds: [11, 12, 13] }) }),
    }));
  });
});
