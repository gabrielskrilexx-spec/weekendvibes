import type { Request, Response } from "express";
import { getExecutiveObservabilityReport } from "./db";
import { normalizeObservabilityPeriod } from "./observability";

export async function executiveObservabilityReportHandler(req: Request, res: Response) {
  try {
    const requestedDays = Number(req.query?.days ?? 14);
    const report = await getExecutiveObservabilityReport(new Date(), normalizeObservabilityPeriod(requestedDays));
    res.status(200).json({ ok: true, report });
  } catch (error) {
    console.error("[ExecutiveReport] failed", error instanceof Error ? error.message : String(error));
    res.status(500).json({ ok: false, error: "Não foi possível gerar o relatório executivo." });
  }
}
