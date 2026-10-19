import type { Request, Response } from "express";
import { getExecutiveObservabilityReport } from "./db";
import { notifyWeeklyExecutiveReport } from "./alert-webhook";
import { redactError } from "./_core/security";

export async function sendWeeklyExecutiveReport(now = new Date()) {
  const report = await getExecutiveObservabilityReport(now, 30);
  const delivery = await notifyWeeklyExecutiveReport(report);
  return { report, delivery };
}

export async function maybeSendWeeklyExecutiveReport(now = new Date()) {
  if (now.getUTCDay() !== 0) return { sent: false, reason: "not-weekly-day" as const };
  const result = await sendWeeklyExecutiveReport(now);
  return { sent: true, ...result };
}

export async function weeklyExecutiveReportHandler(_req: Request, res: Response) {
  try {
    const result = await sendWeeklyExecutiveReport(new Date());
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("[WeeklyExecutiveReport] failed", redactError(error));
    return res.status(500).json({ ok: false, error: "Não foi possível gerar o relatório semanal." });
  }
}
