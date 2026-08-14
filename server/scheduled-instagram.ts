import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { InstagramIntegrationFailure } from "./instagram-pipeline";
import { recordOperationalAlert, OperationalIntegration } from "./db";
import { runInstagramAgendaStep } from "./agenda-routine";
import { HttpError } from "@shared/_core/errors";

const integrationTitles: Record<OperationalIntegration, string> = {
  meta: "Falha na API oficial do Instagram",
  public: "Falha na coleta pública do Instagram",
  ocr: "Falha no OCR da Agenda da Semana",
  openai: "Falha no enriquecimento com OpenAI",
  pipeline: "Falha no pipeline do Instagram",
};

export async function ingestInstagramHandler(req: Request, res: Response) {
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
    const { archived, result } = await runInstagramAgendaStep();
    return res.json({ ok: true, startedAt, finishedAt: new Date().toISOString(), archived, result });
  } catch (error) {
    const integration: OperationalIntegration = error instanceof InstagramIntegrationFailure ? error.integration : "pipeline";
    const message = error instanceof Error ? error.message : String(error);
    try {
      await recordOperationalAlert({ integration, title: integrationTitles[integration], message: `A ingestão automática falhou: ${message}` });
    } catch (alertError) {
      console.warn("[Instagram] Could not persist operational alert:", alertError);
    }
    try {
      await notifyOwner({ title: integrationTitles[integration], content: message });
    } catch (notificationError) {
      console.warn("[Instagram] Could not notify project owner:", notificationError);
    }
    return res.status(500).json({ ok: false, error: message, integration, startedAt, finishedAt: new Date().toISOString() });
  }
}
