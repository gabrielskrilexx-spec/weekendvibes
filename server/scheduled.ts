import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runFullAgendaRoutine, runPublicAgendaStep } from "./agenda-routine";
import { HttpError } from "@shared/_core/errors";

export async function ingestEventsHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 403) {
      return res.status(403).json({ error: "cron-only" });
    }
    return res.status(500).json({ error: String(error), stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });
  try {
    const { archived, result } = await runPublicAgendaStep();
    return res.json({ ok: true, archived, result, startedAt, finishedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: String(error), stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}

export async function ingestFullAgendaHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 403) return res.status(403).json({ error: "cron-only" });
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, startedAt, finishedAt: new Date().toISOString() });
  }
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });
  try {
    const result = await runFullAgendaRoutine();
    return res.json({ ok: true, startedAt, finishedAt: new Date().toISOString(), result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, startedAt, finishedAt: new Date().toISOString() });
  }
}
