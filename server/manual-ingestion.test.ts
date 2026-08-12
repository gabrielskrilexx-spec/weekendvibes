import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archiveExpiredSoldOutEvents: vi.fn().mockResolvedValue(0),
  runIngestionPipeline: vi.fn().mockResolvedValue({ imported: 2 }),
  runInstagramPipeline: vi.fn().mockResolvedValue({ imported: 1 }),
  listHeartbeatJobs: vi.fn(),
}));

vi.mock("./db", () => ({ archiveExpiredSoldOutEvents: mocks.archiveExpiredSoldOutEvents, recordOperationalAlert: vi.fn() }));
vi.mock("./ingestion", () => ({ runIngestionPipeline: mocks.runIngestionPipeline }));
vi.mock("./instagram-pipeline", () => ({ InstagramIntegrationFailure: class InstagramIntegrationFailure extends Error {}, runInstagramPipeline: mocks.runInstagramPipeline }));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn() }));
vi.mock("./_core/heartbeat", () => ({ listHeartbeatJobs: mocks.listHeartbeatJobs }));

import { getNextTuesdayExecution, getTuesdayRoutineStatus, runTuesdayRoutineNow } from "./manual-ingestion";

describe("manual Tuesday routine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listHeartbeatJobs.mockResolvedValue({ total: 1, actorUserId: "owner", jobs: [{ taskUid: "runtime-uid", name: "qualquer nome", description: "Agenda semanal", cronExpression: "0 0 10 * * 2", isEnable: true, timezone: "America/Sao_Paulo", runMode: "full_auto", nextExecutionAt: "2026-08-18T13:00:00.000Z", lastExecutedAt: "2026-08-12T15:04:27.093Z" }] });
  });
  it("calcula a próxima terça às 10h no fuso de São Paulo", async () => {
    expect(getNextTuesdayExecution(new Date("2026-08-12T15:00:00.000Z"))).toBe("2026-08-18T13:00:00.000Z");
    const status = await getTuesdayRoutineStatus(new Date("2026-08-12T15:00:00.000Z"));
    expect(status.cron).toBe("0 0 10 * * 2");
    expect(status.timezone).toBe("America/Sao_Paulo");
    expect(status.runMode).toBe("full_auto");
    expect(status.nextExecutionAt).toBe("2026-08-18T13:00:00.000Z");
    expect(status.lastExecutedAt).toBe("2026-08-12T15:04:27.093Z");
    expect(status.source).toBe("heartbeat");
  });
  it("retorna metadata indisponível quando nenhum job estruturado corresponde à rotina", async () => {
    mocks.listHeartbeatJobs.mockResolvedValue({ total: 1, actorUserId: "owner", jobs: [{ cronExpression: "0 0 10 * * 2", isEnable: true, timezone: "America/Sao_Paulo", runMode: "manual" }] });
    const status = await getTuesdayRoutineStatus();
    expect(status.source).toBe("metadata-unavailable");
    expect(status.nextExecutionAt).toBeNull();
    expect(status.runMode).toBeNull();
  });

  it("compartilha a execução em andamento e não dispara duas coletas", async () => {
    const first = runTuesdayRoutineNow();
    const second = runTuesdayRoutineNow();
    expect(first).toBe(second);
    await first;
    expect(mocks.archiveExpiredSoldOutEvents).toHaveBeenCalledTimes(1);
    expect(mocks.runIngestionPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.runInstagramPipeline).toHaveBeenCalledTimes(1);
    expect(mocks.archiveExpiredSoldOutEvents.mock.invocationCallOrder[0]).toBeLessThan(mocks.runIngestionPipeline.mock.invocationCallOrder[0]);
    expect(mocks.runIngestionPipeline.mock.invocationCallOrder[0]).toBeLessThan(mocks.runInstagramPipeline.mock.invocationCallOrder[0]);
  });
});
