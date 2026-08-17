import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runFullAgendaRoutine, runPublicAgendaStep } from "./agenda-routine";
import { HttpError } from "@shared/_core/errors";
import { redactError } from "./_core/security";

export async function ingestEventsHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 403) {
      return res.status(403).json({ error: "cron-only" });
    }
    console.error("[Scheduled] authentication failed", redactError(error));
    return res.status(500).json({ error: "internal_error" });
  }
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });
  try {
    const { archived, result } = await runPublicAgendaStep();
    return res.json({ ok: true, archived, result, startedAt, finishedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Scheduled] routine failed", redactError(error));
    return res.status(500).json({ error: "internal_error" });
  }
}

export async function ingestFullAgendaHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 403) return res.status(403).json({ error: "cron-only" });
    console.error("[Scheduled] routine failed", redactError(error));
    return res.status(500).json({ ok: false, error: "internal_error", startedAt, finishedAt: new Date().toISOString() });
  }
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });
  try {
    const result = await runFullAgendaRoutine();
    return res.json({ ok: true, startedAt, finishedAt: new Date().toISOString(), result });
  } catch (error) {
    console.error("[Scheduled] routine failed", redactError(error));
    return res.status(500).json({ ok: false, error: "internal_error", startedAt, finishedAt: new Date().toISOString() });
  }
}
