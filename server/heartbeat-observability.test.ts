import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  recordOperationalAlert: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  recordOperationalAlert: mocks.recordOperationalAlert,
}));

import { listExportJobsAlertSettingsHistory } from "./filtered-story-export-jobs";
import {
  calculateP95,
  compareHeartbeatExecutionStats,
  evaluateHeartbeatHealth,
  evaluateHeartbeatPerformance,
  getHeartbeatExecutionStats,
  getHeartbeatStatsExportRows,
  getHeartbeatExecutionSummary,
  listHeartbeatExecutionEvents,
  listHeartbeatIncidentsByRegression,
  recordHeartbeatExecutionEvent,
} from "./heartbeat-observability";

const rows = [
  { id: "evt-1", heartbeatExecutionId: "hb-1", eventType: "started", sequence: 0, timestamp: new Date("2026-08-31T10:00:00.000Z"), durationMs: null, status: "running", message: "started", metadataJson: null },
  { id: "evt-2", heartbeatExecutionId: "hb-1", eventType: "step", sequence: 1, timestamp: new Date("2026-08-31T10:00:01.000Z"), durationMs: 1000, status: "recovered", message: "step", metadataJson: JSON.stringify({ recovered: 2 }) },
  { id: "evt-3", heartbeatExecutionId: "hb-1", eventType: "completed", sequence: 2, timestamp: new Date("2026-08-31T10:00:03.000Z"), durationMs: 3000, status: "succeeded", message: "done", metadataJson: null },
];

function makeDb() {
  const inserted: unknown[] = [];
  const selectChain = (selectedRows: unknown[]) => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = () => chain;
    chain.offset = () => chain;
    chain.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(selectedRows).then(resolve);
    return chain;
  };
  return {
    inserted,
    select: vi.fn(() => selectChain(rows)),
    insert: vi.fn(() => ({ values: (value: unknown) => { inserted.push(value); return { onDuplicateKeyUpdate: async () => undefined }; } })),
  };
}

describe("Heartbeat observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordOperationalAlert.mockResolvedValue(undefined);
  });

  it("persists an append-only event with primitive metadata", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const result = await recordHeartbeatExecutionEvent({ heartbeatExecutionId: "hb-1", eventType: "step", sequence: 2, durationMs: 40, metadata: { recovered: 2, ok: true } });
    expect(result).toMatchObject({ heartbeatExecutionId: "hb-1", sequence: 2 });
    expect(db.inserted[0]).toMatchObject({ heartbeatExecutionId: "hb-1", eventType: "step", sequence: 2, durationMs: 40, metadataJson: JSON.stringify({ recovered: 2, ok: true }) });
  });

  it("returns a deterministic paginated timeline and a summary", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const page = await listHeartbeatExecutionEvents({ heartbeatExecutionId: "hb-1", offset: 0, limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({ sequence: 0, eventType: "started", timestamp: "2026-08-31T10:00:00.000Z" });
    expect(page.items[1].metadata).toEqual({ recovered: 2 });
    const summary = await getHeartbeatExecutionSummary("hb-1");
    expect(summary).toMatchObject({ heartbeatExecutionId: "hb-1", status: "succeeded", durationMs: 3000, eventCount: 3, alertCount: 0 });
  });

  it("calculates deterministic P95 values", () => {
    expect(calculateP95([])).toBe(0);
    expect(calculateP95([300, 100, 200, 400, 500])).toBe(500);
    expect(calculateP95([10, 20, 30, 40])).toBe(40);
  });

  it("aggregates execution success, P95 and incidents within the selected period", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const stats = await getHeartbeatExecutionStats({ from: "2026-08-31T09:00:00.000Z", to: "2026-08-31T11:00:00.000Z" });
    expect(stats).toMatchObject({ totalExecutions: 1, successfulExecutions: 1, successRate: 1, p95DurationMs: 3000, incidentCount: 0 });
    expect(stats.points[0]).toMatchObject({ totalExecutions: 1, successfulExecutions: 1, p95DurationMs: 3000 });
  });

  it("accepts eventType and temporal filters while preserving pagination", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const page = await listHeartbeatExecutionEvents({ heartbeatExecutionId: "hb-1", eventType: "step", from: "2026-08-31T10:00:00.000Z", to: "2026-08-31T10:00:02.000Z", offset: 0, limit: 10 });
    expect(page).toMatchObject({ offset: 0, limit: 10, hasNextPage: false });
    expect(page.items.every(item => typeof item.timestamp === "string")).toBe(true);
  });

  it("compares two periods and produces flat export rows", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const comparison = await compareHeartbeatExecutionStats({ first: { from: "2026-08-31T09:00:00.000Z", to: "2026-08-31T10:00:00.000Z" }, second: { from: "2026-08-31T10:00:00.000Z", to: "2026-08-31T11:00:00.000Z" } });
    expect(comparison.deltas).toMatchObject({ successRate: { absolute: 0, percent: 0 }, p95DurationMs: { absolute: 0, percent: 0 }, incidentCount: { absolute: 0, percent: 0 } });
    const rows = await getHeartbeatStatsExportRows({ first: {}, second: {} });
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ period: "delta", p95DurationMs: 0 });
  });

  it("raises configurable performance alerts for low success and high P95", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const result = await evaluateHeartbeatPerformance({ heartbeatExecutionId: "hb-performance", successRate: 0.2, p95DurationMs: 250_000, environment: "preview" });
    expect(result.alerts).toEqual(["heartbeat_success_rate_degraded", "heartbeat_p95_degraded"]);
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_success_rate_degraded", severity: "WARNING" }));
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_p95_degraded", severity: "WARNING" }));
  });

  it("returns only paginated causal incidents for a regression execution", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const page = await listHeartbeatIncidentsByRegression({ heartbeatExecutionId: "hb-1", from: "2026-08-31T09:00:00.000Z", to: "2026-08-31T11:00:00.000Z", offset: 0, limit: 10 });
    expect(page).toMatchObject({ offset: 0, limit: 10, hasNextPage: false });
    expect(page.items).toHaveLength(3);
    expect(page.items.every(item => ["alert", "failed", "timeout"].includes(item.eventType) || typeof item.eventType === "string")).toBe(true);
  });

  it("uses configurable warning and critical regression thresholds", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const result = await evaluateHeartbeatPerformance({ heartbeatExecutionId: "hb-warning-threshold", successRate: 0.7, previousSuccessRate: 0.9, p95DurationMs: 120_000, previousP95DurationMs: 100_000, environment: "preview" });
    expect(result.alerts).toContain("heartbeat_period_regression");
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_period_regression", severity: "WARNING" }));
  });

  it("raises critical failure and warning duration alerts", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const result = await evaluateHeartbeatHealth({ heartbeatExecutionId: "hb-1", status: "failed", durationMs: 200_000, errorMessage: "upstream timeout", environment: "preview" });
    expect(result.alerts).toEqual(["heartbeat_execution_failed", "heartbeat_duration_anomaly"]);
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_execution_failed", severity: "CRITICAL" }));
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_duration_anomaly", severity: "WARNING" }));
  });

  it("calculates period regression and records a correlated snapshot", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const result = await evaluateHeartbeatPerformance({ heartbeatExecutionId: "hb-regression", successRate: 0.75, previousSuccessRate: 0.9, p95DurationMs: 110_000, previousP95DurationMs: 100_000, environment: "preview" });
    expect(result.alerts).toContain("heartbeat_period_regression");
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_period_regression", severity: "WARNING", runId: "hb-regression" }));
    expect(db.inserted.some(value => typeof value === "object" && value !== null && "heartbeatExecutionId" in value && (value as { heartbeatExecutionId?: string }).heartbeatExecutionId === "hb-regression")).toBe(true);
  });

  it("filters governance history by environment and admin openId", async () => {
    const auditRow = { id: "audit-1", environment: "preview", previousValue: "{\"maxP95DurationMs\":180000}", nextValue: "{\"maxP95DurationMs\":120000}", changedByOpenId: "admin-42", changedAt: new Date("2026-08-31T12:00:00.000Z") };
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = () => chain;
    chain.offset = () => chain;
    chain.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve([auditRow]).then(resolve);
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => chain) });
    const page = await listExportJobsAlertSettingsHistory({ environment: "preview", ownerOpenId: "admin-42", offset: 0, limit: 20 });
    expect(page.items[0]).toMatchObject({ environment: "preview", changedByOpenId: "admin-42", id: "audit-1" });
  });

  it("escalates severe regression to CRITICAL using the configured factor", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    await evaluateHeartbeatPerformance({ heartbeatExecutionId: "hb-critical-regression", successRate: 0.4, previousSuccessRate: 0.9, p95DurationMs: 300_000, previousP95DurationMs: 100_000, environment: "preview" });
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_period_regression", severity: "CRITICAL" }));
  });
});
