import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";
import { ingestEventsHandler } from "./scheduled";
import { runPublicAgendaStep } from "./agenda-routine";

vi.mock("./agenda-routine", () => ({
  runPublicAgendaStep: vi.fn(),
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
  });

  afterEach(() => vi.restoreAllMocks());

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
});
