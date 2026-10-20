import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";
import { ingestEventsHandler, ingestFullAgendaHandler } from "./scheduled";
import { runFullAgendaRoutine, runPublicAgendaStep } from "./agenda-routine";

const mocks = vi.hoisted(() => ({
  runPublicAgendaStep: vi.fn(),
  runFullAgendaRoutine: vi.fn(),
  handleIngestionFailureAlert: vi.fn(),
  notifyIngestionSummary: vi.fn(),
}));

vi.mock("./agenda-routine", () => ({
  runPublicAgendaStep: mocks.runPublicAgendaStep,
  runFullAgendaRoutine: mocks.runFullAgendaRoutine,
}));

vi.mock("./ingestion-failure-alerts", () => ({
  handleIngestionFailureAlert: mocks.handleIngestionFailureAlert,
  notifyIngestionSummary: mocks.notifyIngestionSummary,
}));

const response = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as any;
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

describe("cron authentication and scheduled events callback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(runPublicAgendaStep).mockResolvedValue({ archived: 0, result: { imported: 1 } } as never);
    vi.mocked(runFullAgendaRoutine).mockResolvedValue({ runId: 77, status: "succeeded", errors: [] } as never);
    mocks.handleIngestionFailureAlert.mockResolvedValue({ notified: true });
    mocks.notifyIngestionSummary.mockResolvedValue({ sent: false, skipped: true });
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("accepts a platform-issued opaque cron token validated with taskUid", async () => {
    vi.spyOn(sdk, "verifySession").mockResolvedValue(null);
    vi.spyOn(sdk, "getUserInfoWithJwt").mockResolvedValue({
      openId: "cron_XDaw8eu2MTqCxRhwtwMx4M",
      taskUid: "XDaw8eu2MTqCxRhwtwMx4M",
      name: "Heartbeat",
    } as never);

    const user = await sdk.authenticateRequest({ headers: { cookie: "app_session_id=opaque-heartbeat-token" } } as never);

    expect(user.isCron).toBe(true);
    expect(user.taskUid).toBe("XDaw8eu2MTqCxRhwtwMx4M");
  });

  it("returns 2xx for a valid cron callback", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "task-1" } as never);
    const res = response();

    await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("accepts the Vercel Authorization header on the independent public job", async () => {
    vi.stubEnv("CRON_SECRET", "vercel-cron-secret-test");
    const res = response();

    await ingestEventsHandler({ headers: { authorization: "Bearer vercel-cron-secret-test" }, originalUrl: "/api/scheduled/ingest-public-sources" } as never, res);

    expect(runPublicAgendaStep).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, status: "succeeded" }));
  });

  it("returns 403 for a callback without a valid cron token", async () => {
    const res = response();

    await ingestEventsHandler({ headers: {}, originalUrl: "/api/scheduled/ingest-events" } as never, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
    expect(runPublicAgendaStep).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic error when ingestion fails internally", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true, taskUid: "task-1" } as never);
    vi.mocked(runPublicAgendaStep).mockRejectedValue(new Error("database unavailable"));
    const res = response();

    await ingestEventsHandler({ originalUrl: "/api/scheduled/ingest-events" } as never, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "internal_error" });
  });

  it("accepts Vercel Cron Authorization and alerts on a partial full-agenda run", async () => {
    vi.stubEnv("CRON_SECRET", "vercel-cron-secret-test");
    vi.mocked(runFullAgendaRoutine).mockResolvedValue({ runId: 77, status: "partial", errors: [{ sourceKey: "public:zig", message: "HTTP 503" }] } as never);
    const res = response();

    await ingestFullAgendaHandler({ headers: { authorization: "Bearer vercel-cron-secret-test" } } as never, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, status: "partial" }));
    expect(mocks.handleIngestionFailureAlert).toHaveBeenCalledWith(expect.objectContaining({ routine: "full-agenda", sourceKey: "all", status: 207, runId: 77, message: expect.stringContaining("HTTP 503") }), expect.any(Object));
  });
});
