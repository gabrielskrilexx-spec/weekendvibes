import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  recordOperationalAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  recordOperationalAlert: mocks.recordOperationalAlert,
}));

import { finishIngestionRun } from "./ingestion-reports";

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
});

