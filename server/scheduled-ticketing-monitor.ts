import type { Request, Response } from "express";
import { runTicketingMonitorOnce, ticketingMonitorHealthy } from "./ticketing-monitor";
import { redactError } from "./_core/security";

export async function ticketingMonitorHandler(_req: Request, res: Response) {
  try {
    const report = await runTicketingMonitorOnce();
    const healthy = ticketingMonitorHealthy(report);
    return res.status(200).json({ ok: true, healthy, ...report });
  } catch (error) {
    console.error("[TicketingMonitor] failed", redactError(error));
    return res.status(500).json({ ok: false, healthy: false, error: "ticketing-monitor-failed", checkedAt: new Date().toISOString() });
  }
}
