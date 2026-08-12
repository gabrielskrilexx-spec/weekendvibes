import { afterEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";
import { ingestEventsHandler } from "./scheduled";

describe("scheduled ingestion handler", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects non-cron callers", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: false } as never);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(403);
  });

  it("returns a safe result when ingestion source is not configured", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, result: expect.objectContaining({ skipped: true }) }));
  });
});
