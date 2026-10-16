import type { Request, Response } from "express";
import { getExecutiveObservabilityReport, listSystemHealthTransitions, recordSystemHealthTransition } from "./db";
import { normalizeObservabilityPeriod } from "./observability";
import { notifyHealthTransition } from "./alert-webhook";

export async function executiveObservabilityReportHandler(req: Request, res: Response) {
  try {
    const requestedDays = Number(req.query?.days ?? 14);
    const report = await getExecutiveObservabilityReport(new Date(), normalizeObservabilityPeriod(requestedDays));
    const reason = `${report.sources.open} fonte(s) OPEN; ${report.sources.active} fonte(s) ativas; saúde baseada em falhas recentes.`;
    const transition = await recordSystemHealthTransition({ nextStatus: report.system_health_status, reason });
    if (transition && (transition.previousStatus === "healthy" || report.system_health_status === "healthy")) {
      await notifyHealthTransition({ ...transition, observedAt: transition.observedAt.toISOString() });
    }
    const healthTransitions = await listSystemHealthTransitions(10);
    res.status(200).json({ ok: true, report: { ...report, healthTransitions } });
  } catch (error) {
    console.error("[ExecutiveReport] failed", error instanceof Error ? error.message : String(error));
    res.status(500).json({ ok: false, error: "Não foi possível gerar o relatório executivo." });
  }
}
