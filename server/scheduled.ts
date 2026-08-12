import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runIngestionPipeline } from "./ingestion";

export async function ingestEventsHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const result = await runIngestionPipeline();
    return res.json({ ok: true, result, startedAt, finishedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: String(error), stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
