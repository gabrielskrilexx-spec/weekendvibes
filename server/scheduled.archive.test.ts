import { afterEach, describe, expect, it, vi } from "vitest";

const { archiveExpiredSoldOutEvents, runIngestionPipeline } = vi.hoisted(() => ({
  archiveExpiredSoldOutEvents: vi.fn().mockResolvedValue(1),
  runIngestionPipeline: vi.fn().mockResolvedValue({ imported: 0 }),
}));

vi.mock("./db", () => ({ archiveExpiredSoldOutEvents }));
vi.mock("./ingestion", () => ({ runIngestionPipeline }));
vi.mock("./ingestion-failure-alerts", () => ({ notifyIngestionSummary: vi.fn().mockResolvedValue({ sent: false, skipped: true }) }));

import { sdk } from "./_core/sdk";
import { ingestEventsHandler } from "./scheduled";

describe("scheduled archive integration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("archives expired sold-out events before running ingestion and exposes the count", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as never;

    await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);

    expect(archiveExpiredSoldOutEvents).toHaveBeenCalledOnce();
    expect(runIngestionPipeline).toHaveBeenCalledOnce();
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, archived: 1 }));
  });
});
