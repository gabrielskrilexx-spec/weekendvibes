import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runInstagramPipeline } from "./instagram-pipeline";
import { archiveExpiredSoldOutEvents } from "./db";

export async function ingestInstagramHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const archived = await archiveExpiredSoldOutEvents();
    const result = await runInstagramPipeline();
    return res.json({ ok: true, startedAt, finishedAt: new Date().toISOString(), archived, result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error), startedAt, finishedAt: new Date().toISOString() });
  }
}
