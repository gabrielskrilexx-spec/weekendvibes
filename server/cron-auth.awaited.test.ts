import { describe, expect, it, vi } from "vitest";

const reconcileExpiredIngestionRuns = vi.hoisted(() => vi.fn());
vi.mock("./ingestion-reports", () => ({ reconcileExpiredIngestionRuns }));

import { requireInternalCron } from "./_core/cron-auth";

describe("cron authentication waits for stale-run reconciliation", () => {
  it("does not call next until the sweeper resolves", async () => {
    let resolveSweep!: (value: { reconciledCount: number; runIds: number[] }) => void;
    reconcileExpiredIngestionRuns.mockReturnValueOnce(new Promise(resolve => { resolveSweep = resolve; }));
    vi.stubEnv("INTERNAL_CRON_SECRET", "cron-secret-test");
    const next = vi.fn();
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;

    const middlewarePromise = requireInternalCron({ headers: { "x-cron-secret": "cron-secret-test" } } as never, response, next);
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();

    resolveSweep({ reconciledCount: 1, runIds: [146] });
    await middlewarePromise;
    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next when the maintenance sweep fails safely", async () => {
    reconcileExpiredIngestionRuns.mockRejectedValueOnce(new Error("temporary database failure"));
    vi.stubEnv("INTERNAL_CRON_SECRET", "cron-secret-test");
    const next = vi.fn();
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;

    await requireInternalCron({ headers: { "x-cron-secret": "cron-secret-test" } } as never, response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
