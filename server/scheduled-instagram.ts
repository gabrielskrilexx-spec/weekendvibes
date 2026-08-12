import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { runInstagramPipeline, InstagramIntegrationFailure } from "./instagram-pipeline";
import { archiveExpiredSoldOutEvents, recordOperationalAlert, OperationalIntegration } from "./db";

const integrationTitles: Record<OperationalIntegration, string> = {
  apify: "Falha na captura do Instagram",
  ocr: "Falha no OCR da Agenda da Semana",
  openai: "Falha no enriquecimento com OpenAI",
  pipeline: "Falha no pipeline do Instagram",
};

export async function ingestInstagramHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  const user = await sdk.authenticateRequest(req);
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });

  try {
    const archived = await archiveExpiredSoldOutEvents();
    const result = await runInstagramPipeline();
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
