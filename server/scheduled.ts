import type { Request, Response } from "express";
import { sdk } from "./_core/sdk.js";
import * as agendaRoutine from "./agenda-routine.js";
import * as failureAlerts from "./ingestion-failure-alerts.js";
import { HttpError } from "../shared/_core/errors.js";
import { redactError } from "./_core/security.js";
import { notifyOwner } from "./_core/notification.js";
import { hasValidInternalCronSecret } from "./_core/cron-auth.js";

function buildPublicAutomationSummary(result: unknown, startedAt: string, finishedAt: string) {
  const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const reports = Array.isArray(value.sourceReports) ? value.sourceReports.filter(item => item && typeof item === "object") as Array<Record<string, unknown>> : [];
  const fallback = reports.length > 0 ? reports : [value];
  const sources = fallback.map((source, index) => {
    const errors = Array.isArray(source.errors) ? source.errors.slice(0, 10).map(error => ({ status: null, message: String(error instanceof Error ? error.message : error ?? "Falha não especificada").replace(/https?:\/\/[^\s]+/gi, "fonte pública").slice(0, 240) })) : [];
    if (source.skipped === true && typeof source.reason === "string") errors.push({ status: null, message: source.reason.slice(0, 240) });
    return { sourceKey: String(source.sourceKey ?? (reports.length > 0 ? `public-${index + 1}` : "public")), read: Number(source.read ?? source.discovered ?? 0) || 0, added: Number(source.added ?? source.persisted ?? source.imported ?? 0) || 0, updated: Number(source.updated ?? 0) || 0, ignored: Number(source.ignored ?? source.filtered ?? 0) || 0, errors };
  });
  const errors = sources.flatMap(source => source.errors.map(error => ({ sourceKey: source.sourceKey, ...error })));
  const status: "failed" | "partial" | "succeeded" = value.skipped === true ? "failed" : errors.length > 0 ? "partial" : "succeeded";
  return { routine: "public-agenda", status, startedAt, finishedAt, added: sources.reduce((sum, source) => sum + source.added, 0), updated: sources.reduce((sum, source) => sum + source.updated, 0), ignored: sources.reduce((sum, source) => sum + source.ignored, 0), errors, sources };
}

export async function ingestEventsHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  if (!hasValidInternalCronSecret(req)) {
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
  }
  try {
    const configuredSource = process.env.INGESTION_SOURCE_URL ?? process.env.INGESTION_SOURCE_URLS;
    if (configuredSource !== undefined && configuredSource.trim() === "") {
      const finishedAt = new Date().toISOString();
      return res.json({ ok: true, status: "skipped", skipped: true, result: { skipped: true, reason: "Nenhuma fonte pública configurada." }, fetchFailed: 0, startedAt, finishedAt });
    }
    const { archived, result } = await agendaRoutine.runPublicAgendaStep();
    const fetchFailed = Number((result as { filteredByReason?: { fetchFailed?: unknown } }).filteredByReason?.fetchFailed ?? 0);
    if (fetchFailed > 0) {
      try {
        await failureAlerts.handleIngestionFailureAlert({
          routine: "public-agenda",
          sourceKey: "public",
          integration: "public",
          status: 502,
          errorCode: "fetch_failed",
          alertType: "public_fetch_failed",
          message: `${fetchFailed} fonte(s) pública(s) não responderam ou não puderam ser coletadas.`,
          severity: "WARNING",
        }, { notify: async notification => {
          await notifyOwner({ title: "Falha de coleta na public-agenda", content: "Uma ou mais fontes públicas não puderam ser coletadas. Consulte o painel operacional para detalhes sanitizados." });
        }});
      } catch (alertError) {
        console.warn("[Scheduled] Could not persist public fetch alert", redactError(alertError));
      }
    }
    const finishedAt = new Date().toISOString();
    const summary = buildPublicAutomationSummary(result, startedAt, finishedAt);
    try {
      const notification = await failureAlerts.notifyIngestionSummary({ routine: "public-agenda", status: summary.status, startedAt, finishedAt, added: summary.added, updated: summary.updated, ignored: summary.ignored, errors: summary.errors, sources: summary.sources.map(source => ({ sourceKey: source.sourceKey, read: source.read, added: source.added, updated: source.updated, ignored: source.ignored, errors: source.errors.length })) });
      if (!notification.sent) console.info("[Ingestion summary]", JSON.stringify({ routine: "public-agenda", status: summary.status, added: summary.added, updated: summary.updated, ignored: summary.ignored, errors: summary.errors.length, webhook: notification.skipped ? "not_configured" : "unavailable" }));
    } catch (notificationError) {
      console.warn("[Scheduled] Ingestion summary notification failed", redactError(notificationError));
    }
    return res.json({ ok: true, status: summary.status, summary, archived, result, fetchFailed, startedAt, finishedAt });
  } catch (error) {
    console.error("[Scheduled] routine failed", redactError(error));
    return res.status(500).json({ error: "internal_error" });
  }
}

export async function ingestFullAgendaHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  if (!hasValidInternalCronSecret(req)) {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 403) return res.status(403).json({ error: "cron-only" });
      console.error("[Scheduled] routine failed", redactError(error));
      return res.status(500).json({ ok: false, error: "internal_error", startedAt, finishedAt: new Date().toISOString() });
    }
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
  }
  try {
    const result = await agendaRoutine.runFullAgendaRoutine({ trigger: "scheduled" });
    const finishedAt = new Date().toISOString();
    return res.status(result.status === "failed" ? 502 : 200).json({ ok: result.status !== "failed", status: result.status, startedAt, finishedAt, result });
  } catch (error) {
    console.error("[Scheduled] routine failed", redactError(error));
    return res.status(500).json({ ok: false, error: "internal_error", startedAt, finishedAt: new Date().toISOString() });
  }
}
