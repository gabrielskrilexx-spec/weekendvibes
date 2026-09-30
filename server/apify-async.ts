import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import {
  buildInstagramStoriesScraperPayload,
  INSTAGRAM_TARGETS,
  normalizeInstagramMediaPayload,
  getApifySyncTimeoutMs,
  runInstagramPipeline,
  type InstagramPost,
} from "./instagram-pipeline.js";
import {
  findIngestionRunByApifyActor,
  findIngestionRunById,
  finishIngestionRun,
  linkIngestionRunToApifyActor,
  setIngestionRunDetails,
  startIngestionRun,
} from "./ingestion-reports.js";
import { hasValidInternalCronSecret } from "./_core/cron-auth.js";
import { redactError } from "./_core/security.js";
import { claimApifyDailyRequest, claimApifyProcessedItem, completeApifyProcessedItem, recordOperationalAlert } from "./db.js";

export const DEFAULT_APIFY_STORIES_ACTOR_ID = "zaver.api~instagram-stories-highlights-scraper";
const ACTOR_ID = process.env.APIFY_STORIES_ACTOR_ID?.trim() || DEFAULT_APIFY_STORIES_ACTOR_ID;
const DATASET_TIMEOUT_MS = 30_000;

type ApifyDispatchFailure = Error & {
  apifyStatus?: number;
  apifyCode?: "APIFY_ACTOR_NOT_FOUND" | "APIFY_ACTOR_REQUEST_INVALID" | "APIFY_TOKEN_MISSING" | "APIFY_BUDGET_GUARD";
  safeMessage?: string;
};

function createApifyDispatchFailure(status: number, detail: string): ApifyDispatchFailure {
  const actorFailure = status === 404;
  const error = new Error(
    actorFailure
      ? "Erro na Apify (404): Actor público ou credencial não encontrada. Verifique APIFY_STORIES_ACTOR_ID e APIFY_API_TOKEN."
      : "Erro na Apify (400): payload do Actor ou credencial rejeitada. Verifique a configuração da integração."
  ) as ApifyDispatchFailure;
  error.apifyStatus = status;
  error.apifyCode = actorFailure ? "APIFY_ACTOR_NOT_FOUND" : "APIFY_ACTOR_REQUEST_INVALID";
  error.safeMessage = error.message;
  void detail;
  return error;
}

function createApifyConfigurationFailure(code: "APIFY_TOKEN_MISSING" | "APIFY_BUDGET_GUARD", message: string, status: number): ApifyDispatchFailure {
  const error = new Error(message) as ApifyDispatchFailure;
  error.apifyStatus = status;
  error.apifyCode = code;
  error.safeMessage = message;
  return error;
}

function getApifyDispatchFailure(error: unknown) {
  const candidate = error as Partial<ApifyDispatchFailure>;
  if (candidate.apifyStatus === 404 || candidate.apifyStatus === 400 || candidate.apifyStatus === 503) {
    return {
      status: candidate.apifyStatus === 503 ? 503 : 502,
      error: candidate.apifyCode ?? "APIFY_ACTOR_REQUEST_FAILED",
      message: candidate.safeMessage ?? "A configuração do Actor Apify não pôde ser validada.",
    } as const;
  }
  return null;
}

export function getConfiguredApifyStoriesActorId() {
  return ACTOR_ID;
}

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

function readApifyErrorDetail(payload: Record<string, unknown>) {
  const error = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : {};
  const candidates = [error.message, payload.message, payload.raw];
  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim().slice(0, 240) ?? "";
}

function isSessionCredentialFailure(status: number, detail: string) {
  return [401, 403].includes(status) && /cookie|session|login|checkpoint|authentication|unauthorized|forbidden|token/i.test(detail);
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
  if (!token) throw createApifyConfigurationFailure("APIFY_TOKEN_MISSING", "APIFY_API_TOKEN não configurado; a extração foi ignorada com segurança.", 503);
  if (!baseUrl) throw new Error("SCHEDULED_TASK_ENDPOINT_BASE não configurado.");
  const budget = await claimApifyDailyRequest({ units: INSTAGRAM_TARGETS.length });
  if (!budget.allowed) {
    const message = budget.blockedReason === "kill_switch"
      ? "Extração Apify bloqueada pelo kill switch operacional; nenhuma chamada paga foi iniciada."
      : budget.blockedReason === "budget_unavailable"
        ? "Extração Apify bloqueada porque o orçamento persistido não está disponível; nenhuma chamada paga foi iniciada."
        : `Limite diário de chamadas Apify atingido (${budget.requestCount}/${budget.dailyLimit}) em ${budget.dateKey}; novas extrações bloqueadas até a meia-noite de Brasília.`;
    try {
      await recordOperationalAlert({ integration: "pipeline", alertType: budget.blockedReason === "kill_switch" ? "apify_kill_switch_active" : "apify_daily_limit_reached", severity: "CRITICAL", title: "Extração Apify bloqueada", message });
    } catch (alertError) {
      console.warn("[Apify budget] Could not persist budget guard alert", { error: redactError(alertError) });
    }
    throw createApifyConfigurationFailure("APIFY_BUDGET_GUARD", message, 200);
  }

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
      body: JSON.stringify(buildInstagramStoriesScraperPayload(INSTAGRAM_TARGETS)),
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
    const detail = readApifyErrorDetail(payload);
    const sessionFailure = isSessionCredentialFailure(response.status, detail);
    await finishIngestionRun(runId, {
      status: "failed",
      failedCount: 1,
      httpStatus: response.status,
      details: {
        provider: "apify",
        error: sessionFailure
          ? "SESSION_COOKIE_INVALID_OR_EXPIRED"
          : response.status === 404
            ? "APIFY_ACTOR_NOT_FOUND"
            : response.status === 400
              ? "APIFY_ACTOR_REQUEST_INVALID"
              : "ACTOR_START_FAILED",
        kind: sessionFailure ? "session_credentials" : response.status === 404 || response.status === 400 ? "actor_configuration" : "actor_start",
        status: response.status,
        message: sessionFailure
          ? "Credencial de sessão do Actor ausente, inválida ou expirada; atualize o segredo autorizado."
          : response.status === 404
            ? "Actor público ou credencial não encontrada; verifique APIFY_STORIES_ACTOR_ID, APIFY_API_TOKEN e a disponibilidade do Actor na conta."
            : response.status === 400
              ? "Payload do Actor ou credencial rejeitada pela Apify; verifique a configuração da integração."
              : "Apify rejeitou o disparo do Actor.",
      },
    });
    if (sessionFailure) throw new Error("A credencial de sessão do Actor está ausente, inválida ou expirada.");
    if (response.status === 404 || response.status === 400) throw createApifyDispatchFailure(response.status, detail);
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
  await setIngestionRunDetails(runId, {
    provider: "apify",
    actorRunId,
    datasetId,
    callbackToken,
    status: "QUEUED",
    trigger: options.trigger ?? "automatic",
        sessionCookieConfigured: false,
        actorInputContract: "zaver-instagram-stories-highlights-v1",
  });
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
  const candidates = normalizeInstagramMediaPayload(payload).filter((post: InstagramPost) => post.mediaType === "story" || post.mediaType === "highlight");
  const posts: InstagramPost[] = [];
  const fingerprints: string[] = [];
  for (const post of candidates) {
    const mediaUrl = String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? post.thumbnailUrl ?? "").trim();
    const providerItemId = String(post.id ?? post.shortCode ?? "").trim();
    const fingerprint = createHash("sha256")
      .update(["instagram-stories-async", providerItemId, post.ownerUsername ?? post.username ?? "", mediaUrl, post.timestamp ?? post.takenAt ?? ""].join("\u001f"))
      .digest("hex");
    const claimed = await claimApifyProcessedItem({ fingerprint, providerItemId, routine: "instagram-stories-async", mediaUrl, actorRunId });
    if (!claimed) continue;
    posts.push(post);
    fingerprints.push(fingerprint);
  }
  const result = await runInstagramPipeline({ storiesOnly: true, dryRun: false, postsOverride: posts });
  await Promise.all(fingerprints.map(fingerprint => completeApifyProcessedItem(fingerprint)));
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
  try {
    const scheduled = await startAsyncApifyStoriesRun({ trigger: "automatic" });
    return res.status(200).json({ ok: true, accepted: true, runId: scheduled.runId, actorRunId: scheduled.actorRunId, status: scheduled.status });
  } catch (error) {
    console.error("[Instagram async] Actor dispatch failed", redactError(error));
    const message = error instanceof Error ? error.message : "";
    if (candidateIsBudgetGuard(error) || /limite diário|kill switch|orçamento persistido/i.test(message)) {
      return res.status(200).json({ ok: true, accepted: false, status: "SKIPPED", reason: "budget_guard" });
    }
    const providerFailure = getApifyDispatchFailure(error);
    if (providerFailure) return res.status(providerFailure.status).json({ ok: false, ...providerFailure });
    return res.status(502).json({ ok: false, error: "APIFY_DISPATCH_FAILED", message: "A execução foi recusada pelo provedor ou não pôde ser agendada." });
  }
}

function candidateIsBudgetGuard(error: unknown) {
  return (error as Partial<ApifyDispatchFailure>).apifyCode === "APIFY_BUDGET_GUARD";
}

export function readApifyWebhookResourceForTest(body: unknown) { return readResource(body); }
export function compareApifyWebhookTokenForTest(actual: unknown, expected: unknown) { return safeTokenEqual(actual, expected); }
