import type { Request, Response } from "express";
import { getExecutiveObservabilityReport, listSystemHealthTransitions, recordSystemHealthTransition } from "./db";
import { normalizeObservabilityPeriod } from "./observability";
import { notifyHealthTransition, notifyObservabilityReport } from "./alert-webhook";

export async function runExecutiveObservabilityCycle(days = 14) {
  const report = await getExecutiveObservabilityReport(new Date(), normalizeObservabilityPeriod(days));
  const reason = `${report.sources.open} fonte(s) OPEN; ${report.sources.active} fonte(s) ativas; saúde baseada em falhas recentes.`;
  const transition = await recordSystemHealthTransition({ nextStatus: report.system_health_status, reason });
  if (transition) {
    const notification = { ...transition, observedAt: transition.observedAt.toISOString() };
    if (transition.previousStatus === "healthy" || report.system_health_status === "healthy") {
      void notifyHealthTransition(notification).catch(error => console.warn("[ExecutiveReport] health webhook deferred", error instanceof Error ? error.message : "unknown_error"));
    }
    void notifyObservabilityReport(report, notification).catch(error => console.warn("[ExecutiveReport] observability webhook deferred", error instanceof Error ? error.message : "unknown_error"));
  }
  const healthTransitions = await listSystemHealthTransitions(10);
  return { ...report, healthTransitions };
}

export async function executiveObservabilityReportHandler(req: Request, res: Response) {
  try {
    const requestedDays = Number(req.query?.days ?? 14);
    const report = await runExecutiveObservabilityCycle(requestedDays);
    res.status(200).json({ ok: true, report });
  } catch (error) {
    console.error("[ExecutiveReport] failed", error instanceof Error ? error.message : String(error));
    res.status(500).json({ ok: false, error: "Não foi possível gerar o relatório executivo." });
  }
}
