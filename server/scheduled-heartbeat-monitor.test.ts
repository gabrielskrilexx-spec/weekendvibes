import { describe, expect, it, vi, beforeEach } from "vitest";
import { sdk } from "./_core/sdk";
import { heartbeatMonitorHandler } from "./scheduled-heartbeat-monitor";
import { deleteExpiredEvents, getDb, purgeResolvedOperationalAlerts } from "./db";
import { evaluateCriticalFreshnessAlerts, finishIngestionRun, startIngestionRun } from "./ingestion-reports";
import { runPlatformSanitization } from "./platform-sanitization";

vi.mock("./db", () => ({ getDb: vi.fn(), deleteExpiredEvents: vi.fn(), purgeResolvedOperationalAlerts: vi.fn() }));
vi.mock("./ingestion-reports", () => ({
  startIngestionRun: vi.fn().mockResolvedValue(77),
  finishIngestionRun: vi.fn().mockResolvedValue(undefined),
  evaluateCriticalFreshnessAlerts: vi.fn().mockResolvedValue({ evaluated: 0, triggered: 0 }),
}));
vi.mock("./platform-sanitization", () => ({
  runPlatformSanitization: vi.fn().mockResolvedValue({
    cutoff: "2026-09-22T03:00:00.000Z",
    alerts: { resolvedCount: 0, alertTypes: [] },
    manualReview: { expiredCount: 0 },
    reset: { resetCount: 0, sourceKeys: [] },
    paused: { pausedCount: 0, sourceKeys: [] },
  }),
}));

type ResponseStub = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
const response = (): ResponseStub => {
  const res = { status: vi.fn(), json: vi.fn() } as ResponseStub;
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

function fakeDb(latestRun?: Record<string, unknown>) {
  const latestQuery = { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(latestRun ? [latestRun] : []) };
  const eventQuery = { where: vi.fn().mockResolvedValue([{ count: 4 }]) };
  return { select: vi.fn().mockReturnValueOnce({ from: vi.fn().mockReturnValue(latestQuery) }).mockReturnValueOnce({ from: vi.fn().mockReturnValue(eventQuery) }) };
}

describe("heartbeat direct monitor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(startIngestionRun).mockResolvedValue(77);
    vi.mocked(finishIngestionRun).mockResolvedValue(undefined);
    vi.mocked(evaluateCriticalFreshnessAlerts).mockResolvedValue({ evaluated: 0, triggered: 0 });
    vi.mocked(deleteExpiredEvents).mockResolvedValue(0);
    vi.mocked(purgeResolvedOperationalAlerts).mockResolvedValue({ purgedCount: 0, cutoff: new Date().toISOString() });
    vi.mocked(runPlatformSanitization).mockResolvedValue({
      cutoff: "2026-09-22T03:00:00.000Z",
      alerts: { resolvedCount: 0, alertTypes: [] },
      manualReview: { expiredCount: 0 },
      reset: { resetCount: 0, sourceKeys: [] },
      paused: { pausedCount: 0, sourceKeys: [] },
    });
  });

  it("rejects non-cron callers without touching the database", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: false } as never);
    const res = response();
    await heartbeatMonitorHandler({ originalUrl: "/api/scheduled/monitor-heartbeat" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("records a healthy snapshot when a recent ingestion succeeded", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "task-monitor" } as never);
    const finishedAt = new Date(Date.now() - 60_000);
    vi.mocked(getDb).mockResolvedValue(fakeDb({ id: 12, routine: "full-agenda", status: "succeeded", importedCount: 2, failedCount: 0, finishedAt }) as never);
    const res = response();
    await heartbeatMonitorHandler({ originalUrl: "/api/scheduled/monitor-heartbeat" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, healthy: true, persistedPublishedEvents: 4, expiredRemoved: 0, timezone: "America/Sao_Paulo", monitorRunId: 77 }));
    expect(finishIngestionRun).toHaveBeenCalledWith(77, expect.objectContaining({ status: "succeeded", details: expect.objectContaining({ healthy: true }) }));
  });

  it("records the exact expired removal count without touching non-event data", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "task-monitor" } as never);
    vi.mocked(deleteExpiredEvents).mockResolvedValue(3);
    vi.mocked(getDb).mockResolvedValue(fakeDb({ id: 12, routine: "full-agenda", status: "succeeded", importedCount: 2, failedCount: 0, finishedAt: new Date(Date.now() - 60_000) }) as never);
    const res = response();
    await heartbeatMonitorHandler({ originalUrl: "/api/scheduled/monitor-heartbeat" } as never, res as never);
    expect(deleteExpiredEvents).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ expiredRemoved: 3 }));
  });

  it("records a partial snapshot when no recent ingestion exists", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "task-monitor" } as never);
    vi.mocked(getDb).mockResolvedValue(fakeDb() as never);
    const res = response();
    await heartbeatMonitorHandler({ originalUrl: "/api/scheduled/monitor-heartbeat" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, healthy: false }));
    expect(finishIngestionRun).toHaveBeenCalledWith(77, expect.objectContaining({ status: "partial" }));
  });
});
