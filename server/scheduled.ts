import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runPublicAgendaStep } from "./agenda-routine";

export async function ingestEventsHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const { archived, result } = await runPublicAgendaStep();
    return res.json({ ok: true, archived, result, startedAt, finishedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: String(error), stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
