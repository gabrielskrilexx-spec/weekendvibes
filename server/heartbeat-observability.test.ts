import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  recordOperationalAlert: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  recordOperationalAlert: mocks.recordOperationalAlert,
}));

import {
  calculateP95,
  evaluateHeartbeatHealth,
  getHeartbeatExecutionStats,
  getHeartbeatExecutionSummary,
  listHeartbeatExecutionEvents,
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

  it("raises critical failure and warning duration alerts", async () => {
    const db = makeDb();
    mocks.getDb.mockResolvedValue(db);
    const result = await evaluateHeartbeatHealth({ heartbeatExecutionId: "hb-1", status: "failed", durationMs: 200_000, errorMessage: "upstream timeout", environment: "preview" });
    expect(result.alerts).toEqual(["heartbeat_execution_failed", "heartbeat_duration_anomaly"]);
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_execution_failed", severity: "CRITICAL" }));
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "heartbeat_duration_anomaly", severity: "WARNING" }));
  });
});
