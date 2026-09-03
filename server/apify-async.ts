import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import {
  buildInstagramStoriesScraperPayload,
  INSTAGRAM_TARGETS,
  normalizeInstagramMediaPayload,
  getApifySyncTimeoutMs,
  runInstagramPipeline,
  type InstagramPost,
} from "./instagram-pipeline";
import {
  findIngestionRunByApifyActor,
  findIngestionRunById,
  finishIngestionRun,
  linkIngestionRunToApifyActor,
  setIngestionRunDetails,
  startIngestionRun,
} from "./ingestion-reports";
import { hasValidInternalCronSecret } from "./_core/cron-auth";
import { sdk } from "./_core/sdk";
import { HttpError } from "@shared/_core/errors";
import { redactError } from "./_core/security";

const ACTOR_ID = process.env.APIFY_STORIES_ACTOR_ID?.trim() || "automation-lab~instagram-stories-scraper";
const DATASET_TIMEOUT_MS = 30_000;

function getWebhookBaseUrl() {
  return process.env.SCHEDULED_TASK_ENDPOINT_BASE?.trim().replace(/\/$/, "") ?? "";
}

function encodeWebhooks(webhookUrl: string) {
  return Buffer.from(JSON.stringify([
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT"],
      requestUrl: webhookUrl,
      payloadTemplate: '{"resource":{{resource}}}',
    },
  ])).toString("base64url");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = getApifySyncTimeoutMs()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: globalThis.Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function safeTokenEqual(actual: unknown, expected: unknown) {
  if (typeof actual !== "string" || typeof expected !== "string" || !actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isApifyTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || /aborted|timeout|timed out|tempo limite/i.test(error.message));
}

function readResource(body: unknown) {
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const resource = root.resource && typeof root.resource === "object" ? root.resource as Record<string, unknown> : root;
  return {
    id: typeof resource.id === "string" ? resource.id : typeof resource.runId === "string" ? resource.runId : "",
    defaultDatasetId: typeof resource.defaultDatasetId === "string" ? resource.defaultDatasetId : "",
    status: typeof resource.status === "string" ? resource.status : "",
  };
}

export async function startAsyncApifyStoriesRun(options: { trigger?: "manual" | "automatic" } = {}) {
  const token = process.env.APIFY_API_TOKEN?.trim();
  const baseUrl = getWebhookBaseUrl();
  if (!token) throw new Error("APIFY_API_TOKEN não configurado.");
  if (!baseUrl) throw new Error("SCHEDULED_TASK_ENDPOINT_BASE não configurado.");

  const runId = await startIngestionRun({ routine: "instagram-stories-async", sourceKey: "instagram:apify:pending" });
  if (!runId) throw new Error("Não foi possível registrar a execução assíncrona.");

  const callbackToken = randomUUID();
  const webhookUrl = `${baseUrl}/api/webhooks/apify/instagram?token=${encodeURIComponent(callbackToken)}`;
  const query = new URLSearchParams({ token, webhooks: encodeWebhooks(webhookUrl) });
  let response: globalThis.Response;
  try {
    response = await fetchWithTimeout(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?${query.toString()}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "WeekendVibes/1.0" },
      body: JSON.stringify(buildInstagramStoriesScraperPayload(INSTAGRAM_TARGETS, process.env.APIFY_INSTAGRAM_SESSION_COOKIE?.trim())),
    });
  } catch (error) {
    const actorTimedOut = isApifyTimeoutError(error);
    await finishIngestionRun(runId, {
      status: "failed",
      failedCount: 1,
      httpStatus: 0,
      details: {
        provider: "apify",
        error: actorTimedOut ? "ACTOR_TIMEOUT" : "ACTOR_START_TRANSPORT_FAILED",
        kind: actorTimedOut ? "actor_timeout" : "collector_transport",
        message: actorTimedOut ? `Timeout de conexão com o coletor Apify após ${getApifySyncTimeoutMs()} ms.` : "Falha de transporte ao iniciar o coletor Apify.",
      },
    });
    throw new Error(actorTimedOut ? "Timeout de conexão com o coletor Apify." : "Falha de transporte ao iniciar o coletor Apify.", { cause: error });
  }
  const payload = await readJson(response);
  if (!response.ok) {
    await finishIngestionRun(runId, { status: "failed", failedCount: 1, httpStatus: response.status, details: { provider: "apify", error: "ACTOR_START_FAILED", status: response.status } });
    throw new Error(`Apify não aceitou o disparo assíncrono (HTTP ${response.status}).`);
  }

  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  const actorRunId = typeof data.id === "string" ? data.id : "";
  const datasetId = typeof data.defaultDatasetId === "string" ? data.defaultDatasetId : "";
  if (!actorRunId) {
    await finishIngestionRun(runId, { status: "failed", failedCount: 1, httpStatus: 502, details: { provider: "apify", error: "ACTOR_RUN_ID_MISSING" } });
    throw new Error("Apify não retornou o identificador da execução.");
  }

  await linkIngestionRunToApifyActor({ runId, actorRunId });
  await setIngestionRunDetails(runId, { provider: "apify", actorRunId, datasetId, callbackToken, status: "QUEUED", trigger: options.trigger ?? "automatic" });
  return { runId, actorRunId, status: "QUEUED" as const };
}

async function processDataset(run: Awaited<ReturnType<typeof findIngestionRunByApifyActor>>, datasetId: string, actorRunId: string, token: string) {
  if (!run) return;
  const response = await fetchWithTimeout(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}&clean=true`, { headers: { Accept: "application/json", "User-Agent": "WeekendVibes/1.0" } }, DATASET_TIMEOUT_MS);
  const payload = await readJson(response);
  if (!response.ok || !Array.isArray(payload)) {
    await finishIngestionRun(run.id, { status: "failed", failedCount: 1, httpStatus: response.status || 502, details: { provider: "apify", actorRunId, error: "DATASET_READ_FAILED", status: response.status || 502 } });
    return;
  }
  const posts = normalizeInstagramMediaPayload(payload).filter((post: InstagramPost) => post.mediaType === "story" || post.mediaType === "highlight");
  const result = await runInstagramPipeline({ storiesOnly: true, dryRun: false, postsOverride: posts });
  const status = result.degraded ? "partial" : "succeeded";
  await finishIngestionRun(run.id, {
    status,
    importedCount: result.imported,
    failedCount: result.transportFailures.length,
    httpStatus: 200,
    counts: { read: result.receivedPosts, filtered: result.filtered, persisted: result.persisted, approved: result.approvedPosts, structured: result.structuredEvents },
    details: { provider: "apify", actorRunId, datasetId, status: "COMPLETED", trigger: detailsTrigger(run.details), instagram: result },
  });
}

function detailsTrigger(rawDetails: string | null) {
  try {
    const value = rawDetails ? JSON.parse(rawDetails) as Record<string, unknown> : {};
    return value.trigger === "manual" ? "manual" : "automatic";
  } catch {
    return "automatic";
  }
}

export async function apifyInstagramWebhookHandler(req: Request, res: Response) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const resource = readResource(req.body);
  if (!resource.id) return res.status(400).json({ ok: false, error: "APIFY_RUN_ID_MISSING" });
  const run = await findIngestionRunByApifyActor(resource.id);
  if (!run) return res.status(404).json({ ok: false, error: "APIFY_RUN_NOT_FOUND" });
  let details: Record<string, unknown> = {};
  try { details = run.details ? JSON.parse(run.details) as Record<string, unknown> : {}; } catch { return res.status(500).json({ ok: false, error: "RUN_DETAILS_INVALID" }); }
  const authenticatedBySecret = hasValidInternalCronSecret(req);
  if (!safeTokenEqual(token, details.callbackToken) && !authenticatedBySecret) return res.status(403).json({ ok: false, error: "WEBHOOK_TOKEN_INVALID" });
  if (run.status !== "running") return res.status(200).json({ ok: true, duplicate: true });

  const status = resource.status.toUpperCase();
  if (status !== "SUCCEEDED") {
    const actorTimedOut = status === "TIMED_OUT";
    await finishIngestionRun(run.id, { status: "failed", failedCount: 1, httpStatus: actorTimedOut ? 504 : 502, details: { provider: "apify", actorRunId: resource.id, status: status || "FAILED", error: actorTimedOut ? "ACTOR_TIMEOUT" : "ACTOR_NOT_SUCCEEDED", kind: actorTimedOut ? "actor_timeout" : "actor_failed" } });
    return res.status(202).json({ ok: true, accepted: true, status: actorTimedOut ? "TIMEOUT" : "FAILED" });
  }
  const tokenValue = process.env.APIFY_API_TOKEN?.trim();
  const datasetId = resource.defaultDatasetId || String(details.datasetId ?? "");
  if (!tokenValue || !datasetId) return res.status(500).json({ ok: false, error: "DATASET_REFERENCE_MISSING" });
  void processDataset(run, datasetId, resource.id, tokenValue).catch(async error => {
    console.error("[Apify webhook] dataset worker failed", { runId: run.id, actorRunId: resource.id, error: redactError(error) });
    await finishIngestionRun(run.id, { status: "failed", failedCount: 1, httpStatus: 500, details: { provider: "apify", actorRunId: resource.id, error: "DATASET_WORKER_FAILED" } });
  });
  return res.status(202).json({ ok: true, accepted: true, status: "PROCESSING" });
}

export async function reprocessApifyStoriesDatasetHandler(req: Request, res: Response) {
  if (!hasValidInternalCronSecret(req)) return res.status(403).json({ ok: false, error: "cron-only" });
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const actorRunId = typeof body.actorRunId === "string" ? body.actorRunId.trim() : "";
  const datasetId = typeof body.datasetId === "string" ? body.datasetId.trim() : "";
  if (!actorRunId || !datasetId) return res.status(400).json({ ok: false, error: "DATASET_REFERENCE_MISSING" });
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return res.status(503).json({ ok: false, error: "APIFY_TOKEN_MISSING" });
  const existing = await findIngestionRunByApifyActor(actorRunId);
  if (existing?.status === "running") return res.status(202).json({ ok: true, accepted: true, duplicate: true, runId: existing.id, status: "PROCESSING" });
  const runId = await startIngestionRun({ routine: "instagram-stories-reprocess", sourceKey: `instagram:apify:${actorRunId}` });
  if (!runId) return res.status(500).json({ ok: false, error: "INGESTION_RUN_CREATE_FAILED" });
  await setIngestionRunDetails(runId, { provider: "apify", actorRunId, datasetId, status: "PROCESSING", trigger: "manual-reprocess" });
  const run = await findIngestionRunById(runId);
  if (!run) return res.status(500).json({ ok: false, error: "INGESTION_RUN_LOOKUP_FAILED" });
  void processDataset(run, datasetId, actorRunId, token).catch(async error => {
    console.error("[Apify reprocess] dataset worker failed", { runId, actorRunId, error: redactError(error) });
    await finishIngestionRun(runId, { status: "failed", failedCount: 1, httpStatus: 500, details: { provider: "apify", actorRunId, datasetId, error: "DATASET_WORKER_FAILED" } });
  });
  return res.status(202).json({ ok: true, accepted: true, runId, actorRunId, datasetId, status: "PROCESSING" });
}

export async function asyncIngestInstagramHandler(req: Request, res: Response) {
  const authenticatedBySecret = hasValidInternalCronSecret(req);
  if (authenticatedBySecret) {
    console.info("[Instagram async] cron authentication accepted", { mode: "header" });
  }
  if (!authenticatedBySecret) {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      console.info("[Instagram async] cron authentication accepted", { mode: "cookie" });
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 403) return res.status(403).json({ error: "cron-only" });
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  }
  try {
    const scheduled = await startAsyncApifyStoriesRun({ trigger: "automatic" });
    return res.status(202).json({ ok: true, accepted: true, runId: scheduled.runId, actorRunId: scheduled.actorRunId, status: scheduled.status });
  } catch (error) {
    console.error("[Instagram async] Actor dispatch failed", redactError(error));
    return res.status(502).json({ ok: false, error: "APIFY_DISPATCH_FAILED", message: "A execução foi recusada pelo provedor ou não pôde ser agendada." });
  }
}

export function readApifyWebhookResourceForTest(body: unknown) { return readResource(body); }
export function compareApifyWebhookTokenForTest(actual: unknown, expected: unknown) { return safeTokenEqual(actual, expected); }
