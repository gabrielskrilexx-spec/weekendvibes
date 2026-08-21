import { afterEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";
import { ingestEventsHandler } from "./scheduled";
import * as agendaRoutine from "./agenda-routine";
import * as failureAlerts from "./ingestion-failure-alerts";

describe("scheduled ingestion handler", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects non-cron callers", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: false } as never);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(403);
  });

  it("persists and notifies a sanitized public fetch failure without breaking the response", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    vi.spyOn(agendaRoutine, "runPublicAgendaStep").mockResolvedValue({ archived: 0, result: { filteredByReason: { fetchFailed: 2 }, persisted: 0 } } as never);
    const alertSpy = vi.spyOn(failureAlerts, "handleIngestionFailureAlert").mockResolvedValue({ fingerprint: "fp", notified: true, reopened: false, deduplicated: false });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);
    expect(alertSpy).toHaveBeenCalledWith(expect.objectContaining({ routine: "public-agenda", alertType: "public_fetch_failed", errorCode: "fetch_failed" }), expect.objectContaining({ notify: expect.any(Function) }));
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, fetchFailed: 2 }));
  });

  it("returns a safe result when ingestion source is not configured", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    const focused = process.env.INGESTION_FOCUS_URLS;
    delete process.env.INGESTION_FOCUS_URLS;
    vi.stubEnv("INGESTION_SOURCE_URL", "");
    vi.stubEnv("INGESTION_SOURCE_URLS", "");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    try {
      await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);
      expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, result: expect.objectContaining({ skipped: true }) }));
    } finally {
      if (focused === undefined) delete process.env.INGESTION_FOCUS_URLS; else process.env.INGESTION_FOCUS_URLS = focused;
    }
  });
});
