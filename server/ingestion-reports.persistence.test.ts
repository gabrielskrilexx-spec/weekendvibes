import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  recordOperationalAlert: vi.fn().mockResolvedValue(undefined),
  recordIngestionSourceReportSummary: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  recordOperationalAlert: mocks.recordOperationalAlert,
  recordIngestionSourceReportSummary: mocks.recordIngestionSourceReportSummary,
}));

import { finishIngestionRun, reconcileExpiredIngestionRuns } from "./ingestion-reports";

describe("ingestion run observability persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists complete zeroed metrics for a degraded Meta run", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ startedAt: new Date("2026-08-18T10:00:00.000Z") }]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({ set }),
    };
    mocks.getDb.mockResolvedValue(db);

    await finishIngestionRun(42, {
      status: "partial",
      routine: "instagram-agenda",
      sourceKey: "instagram",
      httpStatus: 200,
      durationMs: 1234,
      counts: { read: 0, filtered: 0, persisted: 0 },
      details: { degraded: true, upstreamStatus: 503 },
    });

    expect(db.update).toHaveBeenCalledOnce();
    const persisted = set.mock.calls[0]?.[0];
    expect(persisted).toMatchObject({ status: "partial", durationMs: 1234, httpStatus: 200, importedCount: 0, failedCount: 0 });
    expect(JSON.parse(persisted.counts)).toMatchObject({ read: 0, filtered: 0, persisted: 0, approved: 0, structured: 0 });
  });

  it("persists granular counts and retry history in the audit details", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const db = {
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ startedAt: new Date("2026-08-18T10:00:00.000Z") }]) }) }) }),
      update: vi.fn().mockReturnValue({ set }),
    };
    mocks.getDb.mockResolvedValue(db);
    await finishIngestionRun(43, {
      status: "succeeded",
      routine: "public-agenda",
      sourceKey: "public",
      counts: { read: 12, filtered: 4, structured: 5, persisted: 3, rejectedPastEvents: 2, rejectedOtherReasons: 1 },
      details: { trigger: "scheduled", retries: 1, retryHistory: [{ attempt: 1, startedAt: "2026-08-22T10:00:00.000Z", failedAt: "2026-08-22T10:00:01.000Z", reason: "timeout", httpStatus: 503 }] },
    });
    const persisted = set.mock.calls[0]?.[0];
    expect(JSON.parse(persisted.counts)).toMatchObject({ read: 12, filtered: 4, structured: 5, persisted: 3, rejectedPastEvents: 2, rejectedOtherReasons: 1 });
    expect(JSON.parse(persisted.details)).toMatchObject({ trigger: "scheduled", retries: 1, retryHistory: [expect.objectContaining({ attempt: 1, httpStatus: 503 })] });
  });

  it("updates a source lastMessage from the latest successful sourceReport without changing failure fields", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const db = {
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ startedAt: new Date("2026-11-04T05:34:00.000Z") }]) }) }) }),
      update: vi.fn().mockReturnValue({ set }),
    };
    mocks.getDb.mockResolvedValue(db);

    await finishIngestionRun(44, {
      status: "succeeded",
      routine: "public-agenda",
      sourceKey: "public",
      details: { sourceReports: [{ sourceKey: "public:ingresse", read: 7, added: 0, updated: 2, ignored: 5, errors: [] }] },
    });

    expect(mocks.recordIngestionSourceReportSummary).toHaveBeenCalledWith(
      "public:ingresse",
      "Coleta concluída: 7 lidos, 0 novos, 2 atualizados, 5 ignorados; 0 erro(s).",
      db,
    );
  });

  it("expira run assíncrono QUEUED após duas horas sem consultar a Apify", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 149, routine: "instagram-stories-async", startedAt: new Date("2026-11-24T07:00:00.000Z"), details: JSON.stringify({ status: "QUEUED" }) }]),
        }),
      }),
      update: vi.fn().mockReturnValue({ set }),
    };
    mocks.getDb.mockResolvedValue(db);

    const result = await reconcileExpiredIngestionRuns({ now: new Date("2026-11-24T10:00:00.000Z") });

    expect(result).toMatchObject({ reconciledCount: 1, runIds: [149] });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", failedCount: 1, httpStatus: 504, finishedAt: new Date("2026-11-24T10:00:00.000Z") }));
    expect(JSON.parse(set.mock.calls[0]?.[0]?.details)).toMatchObject({ error: "timeout_exceeded_2h", reconciliation: { reason: "timeout_exceeded_2h", routine: "instagram-stories-async" } });
  });

  it("expira qualquer run aberto antigo, inclusive RUNNING e status nulo equivalente", async () => {
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 146, routine: "instagram-stories-async", startedAt: new Date("2026-11-24T06:00:00.000Z"), details: JSON.stringify({ status: "RUNNING" }) },
            { id: 149, routine: "instagram-stories-async", startedAt: new Date("2026-11-24T06:30:00.000Z"), details: JSON.stringify({ status: null }) },
          ]),
        }),
      }),
      update: vi.fn().mockReturnValue({ set }),
    };
    mocks.getDb.mockResolvedValue(db);
    const result = await reconcileExpiredIngestionRuns({ now: new Date("2026-11-24T10:00:00.000Z") });
    expect(result).toMatchObject({ reconciledCount: 2, runIds: [146, 149] });
    expect(set).toHaveBeenCalledTimes(2);
    expect(mocks.recordOperationalAlert).toHaveBeenCalledTimes(2);
  });
});
