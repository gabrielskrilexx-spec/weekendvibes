import { describe, expect, it, vi } from "vitest";

const { getReport, recordTransition, listTransitions } = vi.hoisted(() => ({ getReport: vi.fn().mockResolvedValue({ generatedAt: "2026-10-16T12:00:00.000Z", periodDays: 14, system_health_status: "degraded", sources: { active: 2, open: 1, waf: 2, meta110: 1, network: 0 }, series: [], trends: { waf: { current: 2, previous: 3, delta: -1, percentage: -33.3, direction: "down" } } }), recordTransition: vi.fn().mockResolvedValue(null), listTransitions: vi.fn().mockResolvedValue([]) }));
vi.mock("./db", () => ({ getExecutiveObservabilityReport: getReport, recordSystemHealthTransition: recordTransition, listSystemHealthTransitions: listTransitions }));

import { executiveObservabilityReportHandler } from "./scheduled-executive-report";

describe("executive observability report endpoint", () => {
  it("retorna payload JSON sem expor detalhes internos", async () => {
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as never;
    await executiveObservabilityReportHandler({ query: { days: "30" } } as never, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, report: expect.objectContaining({ sources: expect.objectContaining({ waf: 2 }) }) }));
    expect(getReport).toHaveBeenCalledWith(expect.any(Date), 30);
    expect(recordTransition).toHaveBeenCalledWith(expect.objectContaining({ nextStatus: "degraded" }));
  });

  it("sanitiza falha inesperada do relatório", async () => {
    getReport.mockRejectedValueOnce(new Error("DATABASE_URL=secret"));
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as never;
    await executiveObservabilityReportHandler({} as never, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ ok: false, error: "Não foi possível gerar o relatório executivo." });
  });

  it("inclui a transição recém-registrada e o histórico no payload", async () => {
    recordTransition.mockResolvedValueOnce({ previousStatus: "healthy", nextStatus: "degraded", reason: "1 fonte OPEN", observedAt: new Date("2026-10-16T12:00:00.000Z") });
    listTransitions.mockResolvedValueOnce([{ id: 1, previousStatus: "healthy", nextStatus: "degraded", reason: "1 fonte OPEN", observedAt: new Date("2026-10-16T12:00:00.000Z") }]);
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as never;
    await executiveObservabilityReportHandler({ query: {} } as never, res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ report: expect.objectContaining({ healthTransitions: expect.any(Array) }) }));
  });
});
