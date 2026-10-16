import { describe, expect, it, vi } from "vitest";

const getReport = vi.hoisted(() => vi.fn().mockResolvedValue({ generatedAt: "2026-10-16T12:00:00.000Z", sources: { active: 2, open: 1, waf: 2, meta110: 1, network: 0 }, series: [], trends: { waf: { current: 2, previous: 3, delta: -1, percentage: -33.3, direction: "down" } } }));
vi.mock("./db", () => ({ getExecutiveObservabilityReport: getReport }));

import { executiveObservabilityReportHandler } from "./scheduled-executive-report";

describe("executive observability report endpoint", () => {
  it("retorna payload JSON sem expor detalhes internos", async () => {
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as never;
    await executiveObservabilityReportHandler({} as never, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, report: expect.objectContaining({ sources: expect.objectContaining({ waf: 2 }) }) }));
  });

  it("sanitiza falha inesperada do relatório", async () => {
    getReport.mockRejectedValueOnce(new Error("DATABASE_URL=secret"));
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as never;
    await executiveObservabilityReportHandler({} as never, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ ok: false, error: "Não foi possível gerar o relatório executivo." });
  });
});
