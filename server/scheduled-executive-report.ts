import type { Request, Response } from "express";
import { getExecutiveObservabilityReport } from "./db";

export async function executiveObservabilityReportHandler(_req: Request, res: Response) {
  try {
    const report = await getExecutiveObservabilityReport();
    res.status(200).json({ ok: true, report });
  } catch (error) {
    console.error("[ExecutiveReport] failed", error instanceof Error ? error.message : String(error));
    res.status(500).json({ ok: false, error: "Não foi possível gerar o relatório executivo." });
  }
}
