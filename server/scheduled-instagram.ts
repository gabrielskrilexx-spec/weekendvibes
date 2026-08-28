import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { InstagramIntegrationFailure, isGracefullyDegradedMetaFailure, getMetaFailureStatus } from "./instagram-pipeline";
import { OperationalIntegration } from "./db";
import { handleIngestionFailureAlert } from "./ingestion-failure-alerts";
import { AgendaStepFailure, runInstagramAgendaStep } from "./agenda-routine";
import { HttpError } from "@shared/_core/errors";
import { redactError } from "./_core/security";
import { hasValidInternalCronSecret } from "./_core/cron-auth";

const integrationTitles: Record<OperationalIntegration, string> = {
  meta: "Falha na API oficial do Instagram",
  public: "Falha na coleta pública do Instagram",
  ocr: "Falha no OCR da Agenda da Semana",
  openai: "Falha no enriquecimento com OpenAI",
  pipeline: "Falha no pipeline do Instagram",
};

export async function ingestInstagramHandler(req: Request, res: Response) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  if (!hasValidInternalCronSecret(req)) {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 403) return res.status(403).json({ error: "cron-only" });
      console.error("[Instagram] authentication failed", redactError(error));
      return res.status(500).json({ ok: false, error: "internal_error", startedAt, finishedAt: new Date().toISOString() });
    }
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
  }

  try {
    const { archived, result } = await runInstagramAgendaStep();
    const finishedAt = new Date().toISOString();
    return res.json({ ok: true, startedAt, finishedAt, durationMs: Date.now() - startedAtMs, archived, degraded: Boolean(result.degraded), transportFailures: result.transportFailures ?? [], result, counts: { read: Number(result.receivedPosts ?? 0), filtered: Math.max(0, Number(result.receivedPosts ?? 0) - Number(result.approvedPosts ?? 0)), persisted: Number(result.imported ?? 0) } });
  } catch (error) {
    const integration: OperationalIntegration = error instanceof AgendaStepFailure
      ? error.integration
      : error instanceof InstagramIntegrationFailure ? error.integration : "pipeline";
    const safeError = redactError(error);
    const metaStatus = integration === "meta"
      ? error instanceof AgendaStepFailure ? error.upstreamStatus : getMetaFailureStatus(error)
      : undefined;
    if (metaStatus === 400) {
      try {
        await handleIngestionFailureAlert({ routine: "instagram-agenda", sourceKey: "instagram", integration: "meta", status: 400, errorCode: "200", message: "A API da Meta rejeitou credenciais ou permissões.", severity: "CRITICAL" }, { notify: async notification => { await notifyOwner({ title: notification.title, content: notification.message }); } });
      } catch (alertError) {
        console.warn("[Instagram] Could not persist Meta credential alert", redactError(alertError));
      }
      console.error("[Instagram] Meta credentials or permissions rejected", { integration: "meta", upstreamStatus: 400 });
      return res.status(400).json({ ok: false, degraded: false, integration: "meta", error: "meta_credentials_or_permissions", upstreamStatus: 400, counts: { read: 0, filtered: 0, persisted: 0 }, durationMs: Date.now() - startedAtMs, startedAt, finishedAt: new Date().toISOString() });
    }
    if (error instanceof AgendaStepFailure ? error.degraded : isGracefullyDegradedMetaFailure(error)) {
      const status = error instanceof AgendaStepFailure ? error.upstreamStatus : getMetaFailureStatus(error);
      try {
        await handleIngestionFailureAlert({ routine: "instagram-agenda", sourceKey: "instagram", integration: "meta", status, message: `A API da Meta respondeu HTTP ${status}; a execução foi concluída sem importar dados.`, severity: "WARNING" });
      } catch (alertError) {
        console.warn("[Instagram] Could not persist degraded Meta alert", redactError(alertError));
      }
      console.warn("[Instagram] Meta upstream unavailable; degraded run with no imported events", { status });
      const finishedAt = new Date().toISOString();
      return res.status(200).json({ ok: true, degraded: true, integration: "meta", error: "upstream_unavailable", upstreamStatus: status, imported: 0, counts: { read: 0, filtered: 0, persisted: 0 }, durationMs: Date.now() - startedAtMs, startedAt, finishedAt });
    }
    try {
      await handleIngestionFailureAlert({ routine: "instagram-agenda", sourceKey: "instagram", integration, status: 500, message: "A ingestão automática falhou. Consulte o painel operacional.", severity: "CRITICAL" }, { notify: async notification => { await notifyOwner({ title: notification.title, content: notification.message }); } });
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
