import { describe, expect, it, vi } from "vitest";

const { getReport, notifyReport } = vi.hoisted(() => ({ getReport: vi.fn().mockResolvedValue({ generatedAt: "2026-10-18T20:00:00.000Z", periodDays: 30, system_health_status: "healthy" }), notifyReport: vi.fn().mockResolvedValue({ delivered: true, skipped: false, status: 204 }) }));
vi.mock("./db", () => ({ getExecutiveObservabilityReport: getReport }));
vi.mock("./alert-webhook", () => ({ notifyWeeklyExecutiveReport: notifyReport }));

import { maybeSendWeeklyExecutiveReport, weeklyExecutiveReportHandler } from "./scheduled-weekly-report";

describe("weekly executive report", () => {
  it("só dispara automaticamente aos domingos", async () => {
    await expect(maybeSendWeeklyExecutiveReport(new Date("2026-10-16T20:00:00.000Z"))).resolves.toEqual({ sent: false, reason: "not-weekly-day" });
    expect(getReport).not.toHaveBeenCalled();
    await expect(maybeSendWeeklyExecutiveReport(new Date("2026-10-18T20:00:00.000Z"))).resolves.toMatchObject({ sent: true, report: expect.any(Object) });
    expect(notifyReport).toHaveBeenCalled();
  });

  it("expõe o job manual protegido como JSON", async () => {
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as never;
    await weeklyExecutiveReportHandler({} as never, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, delivery: expect.objectContaining({ delivered: true }) }));
  });
});
