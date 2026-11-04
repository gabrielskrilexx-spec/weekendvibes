import { afterEach, describe, expect, it, vi } from "vitest";

const { archivePastEvents, archiveExpiredSoldOutEvents, deactivateExpiredSources, runIngestionPipeline } = vi.hoisted(() => ({
  archivePastEvents: vi.fn().mockResolvedValue(0),
  archiveExpiredSoldOutEvents: vi.fn().mockResolvedValue(1),
  deactivateExpiredSources: vi.fn().mockResolvedValue({ deactivatedCount: 0, sourceKeys: [] }),
  runIngestionPipeline: vi.fn().mockResolvedValue({ imported: 0 }),
}));

vi.mock("./db", () => ({ archivePastEvents, archiveExpiredSoldOutEvents, deactivateExpiredSources }));
vi.mock("./ingestion", () => ({ runIngestionPipeline }));
vi.mock("./ingestion-reports", () => ({ startIngestionRun: vi.fn().mockResolvedValue(1), finishIngestionRun: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./scheduled-observability", () => ({ observeScheduledIngestion: vi.fn().mockResolvedValue({ durationMs: 1, alerts: [] }) }));
vi.mock("./ingestion-failure-alerts", () => ({ notifyIngestionSummary: vi.fn().mockResolvedValue({ sent: false, skipped: true }) }));

import { sdk } from "./_core/sdk";
import { ingestEventsHandler } from "./scheduled";

describe("scheduled archive integration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("archives expired sold-out events before running ingestion and exposes the count", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as never;

    await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);

    expect(archivePastEvents).toHaveBeenCalledOnce();
    expect(archiveExpiredSoldOutEvents).toHaveBeenCalledOnce();
    expect(runIngestionPipeline).toHaveBeenCalledOnce();
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, archived: 1 }));
  });
});
