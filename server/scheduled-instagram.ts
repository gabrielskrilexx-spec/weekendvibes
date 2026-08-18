import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { InstagramIntegrationFailure, isGracefullyDegradedMetaFailure, getMetaFailureStatus } from "./instagram-pipeline";
import { recordOperationalAlert, OperationalIntegration } from "./db";
import { runInstagramAgendaStep } from "./agenda-routine";
import { HttpError } from "@shared/_core/errors";
import { redactError } from "./_core/security";

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
    console.error("[Instagram] authentication failed", redactError(error));
    return res.status(500).json({ ok: false, error: "internal_error", startedAt, finishedAt: new Date().toISOString() });
  }
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });

  try {
    const { archived, result } = await runInstagramAgendaStep();
    return res.json({ ok: true, startedAt, finishedAt: new Date().toISOString(), archived, result });
  } catch (error) {
    const integration: OperationalIntegration = error instanceof InstagramIntegrationFailure ? error.integration : "pipeline";
    const safeError = redactError(error);
    if (isGracefullyDegradedMetaFailure(error)) {
      const status = getMetaFailureStatus(error);
      try {
        await recordOperationalAlert({ integration: "meta", title: integrationTitles.meta, message: `A API da Meta respondeu HTTP ${status}; a execução foi concluída sem importar dados.` });
      } catch (alertError) {
        console.warn("[Instagram] Could not persist degraded Meta alert", redactError(alertError));
      }
      console.warn("[Instagram] Meta upstream unavailable; degraded run with no imported events", { status });
      return res.status(200).json({ ok: true, degraded: true, integration: "meta", error: "upstream_unavailable", upstreamStatus: status, imported: 0, startedAt, finishedAt: new Date().toISOString() });
    }
    try {
      await recordOperationalAlert({ integration, title: integrationTitles[integration], message: "A ingestão automática falhou. Consulte o painel operacional." });
    } catch (alertError) {
      console.warn("[Instagram] Could not persist operational alert", redactError(alertError));
    }
    try {
      await notifyOwner({ title: integrationTitles[integration], content: "A ingestão automática falhou. Consulte o painel operacional." });
    } catch (notificationError) {
      console.warn("[Instagram] Could not notify project owner", redactError(notificationError));
    }
    console.error("[Instagram] ingestion failed", { integration, ...safeError });
    return res.status(500).json({ ok: false, error: "internal_error", integration, startedAt, finishedAt: new Date().toISOString() });
  }
}
