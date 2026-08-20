import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archiveExpiredSoldOutEvents: vi.fn().mockResolvedValue(4),
  runIngestionPipeline: vi.fn().mockResolvedValue({ imported: 2 }),
  runInstagramPipeline: vi.fn().mockResolvedValue({ imported: 1 }),
}));

vi.mock("./db", () => ({ archiveExpiredSoldOutEvents: mocks.archiveExpiredSoldOutEvents }));
vi.mock("./ingestion", () => ({ runIngestionPipeline: mocks.runIngestionPipeline }));
vi.mock("./instagram-pipeline", () => ({ runInstagramPipeline: mocks.runInstagramPipeline, isGracefullyDegradedMetaFailure: vi.fn().mockReturnValue(false), getMetaFailureStatus: vi.fn().mockReturnValue(null) }));

import { AGENDA_ROUTINE_COMPOSITION, normalizeTrackedStepResultForTest, runFullAgendaRoutine, runInstagramAgendaStep, runPublicAgendaStep } from "./agenda-routine";

describe("agenda routine composition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normaliza o resultado aninhado da fonte pública para persistência operacional", () => {
    expect(normalizeTrackedStepResultForTest({ archived: 0, result: { read: 60, filtered: 58, persisted: 1, duplicates: 1 } })).toEqual({ read: 60, filtered: 58, persisted: 1, duplicates: 1 });
    expect(normalizeTrackedStepResultForTest({ read: 3, filtered: 2, persisted: 1 })).toEqual({ read: 3, filtered: 2, persisted: 1 });
  });

  it("compõe o fluxo completo manual com arquivamento único e as duas fontes", async () => {
    const result = await runFullAgendaRoutine();
    expect(result).toEqual({ archived: 4, publicSources: { imported: 2 }, instagram: { imported: 1 } });
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
});
