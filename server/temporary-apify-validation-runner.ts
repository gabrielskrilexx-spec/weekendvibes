import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { appSettings, ingestionRuns } from "../drizzle/schema";
import {
  getApifyDailyUsageStatus,
  getDb,
  isApifyIngestionKillSwitchEnabled,
  listEnabledInstagramSources,
} from "./db";
import { registerBackgroundTask } from "./background-tasks";
import { startAsyncApifyStoriesRun } from "./apify-async";
import { INSTAGRAM_TARGETS } from "./instagram-pipeline";

const TOKEN_ENV_KEY = "WV_TEMPORARY_APIFY_VALIDATION_TOKEN_20261103";
const RUNNER_MARKER_KEY = "temporary_apify_validation_runner_used_20261103";
const MAX_TOKEN_BYTES = 4096;
const AUTHORIZED_TARGET_COUNT = 14;

function constantTimeMatch(expected: string, supplied: string) {
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedDigest = createHash("sha256").update(expectedBytes.subarray(0, MAX_TOKEN_BYTES)).digest();
  const suppliedDigest = createHash("sha256").update(suppliedBytes.subarray(0, MAX_TOKEN_BYTES)).digest();
  const expectedLength = Buffer.alloc(8);
  const suppliedLength = Buffer.alloc(8);
  expectedLength.writeBigUInt64BE(BigInt(expectedBytes.length));
  suppliedLength.writeBigUInt64BE(BigInt(suppliedBytes.length));
  const digestMatches = timingSafeEqual(expectedDigest, suppliedDigest);
  const lengthMatches = timingSafeEqual(expectedLength, suppliedLength);
  const validLengths = Number(expectedBytes.length <= MAX_TOKEN_BYTES) & Number(suppliedBytes.length <= MAX_TOKEN_BYTES);
  return (Number(digestMatches) & Number(lengthMatches) & validLengths) === 1;
}

export function authenticateTemporaryApifyValidationRunner(req: Request, res: Response, next: NextFunction) {
  const expectedToken = process.env[TOKEN_ENV_KEY]?.trim();
  if (!expectedToken) return res.status(404).json({ error: "not_found" });
  const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!constantTimeMatch(expectedToken, suppliedToken)) return res.status(401).json({ error: "unauthorized" });
  return next();
}

export function hasUnexpectedRequestBody(req: Request) {
  if (req.headers["transfer-encoding"] !== undefined) return true;
  const rawContentLength = req.headers["content-length"];
  if (rawContentLength !== undefined) {
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength !== 0) return true;
  }
  const body = req.body;
  if (body === undefined || body === null || body === "") return false;
  if (typeof body !== "object" || Array.isArray(body)) return true;
  return Object.keys(body).length > 0;
}

function normalizeHandle(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/^@+/, "").replace(/\/+$/, "").toLowerCase() : "";
}

export function getEligibleInstagramTargets(sources: ReadonlyArray<{ handle: string | null }>) {
  const activeHandles = new Set(sources.map(source => normalizeHandle(source.handle)).filter(Boolean));
  return INSTAGRAM_TARGETS.filter(target => activeHandles.has(normalizeHandle(target.username)));
}

export function getTemporaryApifyPreflightFailure(input: {
  killSwitchEnabled: boolean;
  sourceCount: number;
  uniqueHandleCount: number;
  supportedTargetCount: number;
  activeRunCount: number;
  budgetPersistent: boolean;
  remainingUnits: number;
}) {
  if (input.killSwitchEnabled) return { error: "apify_kill_switch_active" } as const;
  if (input.sourceCount !== AUTHORIZED_TARGET_COUNT || input.supportedTargetCount !== AUTHORIZED_TARGET_COUNT || input.uniqueHandleCount !== AUTHORIZED_TARGET_COUNT) {
    return { error: "instagram_target_set_changed", activeSourceCount: input.sourceCount, supportedTargetCount: input.supportedTargetCount } as const;
  }
  if (input.activeRunCount > 0) return { error: "instagram_apify_run_already_active" } as const;
  if (!input.budgetPersistent || input.remainingUnits < AUTHORIZED_TARGET_COUNT) {
    return { error: "apify_budget_unavailable_or_insufficient", requiredUnits: AUTHORIZED_TARGET_COUNT, remainingUnits: input.budgetPersistent ? input.remainingUnits : null } as const;
  }
  return null;
}

function safeFailureCode(error: unknown) {
  const status = error && typeof error === "object" ? (error as { apifyStatus?: unknown }).apifyStatus : undefined;
  if (status === 400 || status === 404) return `apify_http_${status}`;
  if (error instanceof Error && /quota|limite diário|budget/i.test(error.message)) return "budget_blocked";
  return "dispatch_failed";
}

export async function temporaryApifyValidationRunnerHandler(req: Request, res: Response) {
  if (hasUnexpectedRequestBody(req)) return res.status(400).json({ error: "empty_body_required" });

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "database_unavailable" });
  if (!process.env.APIFY_API_TOKEN?.trim() || !process.env.SCHEDULED_TASK_ENDPOINT_BASE?.trim()) {
    return res.status(503).json({ error: "apify_runtime_configuration_unavailable" });
  }

  try {
    const killSwitchEnabled = await isApifyIngestionKillSwitchEnabled(db);
    const [sources, usage, activeRuns] = await Promise.all([
      listEnabledInstagramSources(db),
      getApifyDailyUsageStatus({ dbOverride: db }),
      db.select({ id: ingestionRuns.id })
        .from(ingestionRuns)
        .where(and(eq(ingestionRuns.routine, "instagram-stories-async"), eq(ingestionRuns.status, "running")))
        .limit(1),
    ]);
    const activeHandles = new Set(sources.map(source => normalizeHandle(source.handle)).filter(Boolean));
    const targets = getEligibleInstagramTargets(sources);
    const preflightFailure = getTemporaryApifyPreflightFailure({
      killSwitchEnabled,
      sourceCount: sources.length,
      uniqueHandleCount: activeHandles.size,
      supportedTargetCount: targets.length,
      activeRunCount: activeRuns.length,
      budgetPersistent: usage.persistence,
      remainingUnits: usage.remaining,
    });
    if (preflightFailure) return res.status(409).json(preflightFailure);

    const claim = await db.insert(appSettings)
      .values({ key: RUNNER_MARKER_KEY, value: `claimed:${new Date().toISOString()}` })
      .onConflictDoNothing()
      .returning({ key: appSettings.key });
    if (claim.length === 0) return res.status(409).json({ error: "runner_already_used" });

    const dispatch = startAsyncApifyStoriesRun({ trigger: "manual", targets });
    const task = dispatch.then(async result => {
      try {
        await db.update(appSettings)
          .set({ value: `accepted:${result.runId}`, updatedAt: new Date() })
          .where(eq(appSettings.key, RUNNER_MARKER_KEY));
      } catch {
        console.warn("[temporary Apify validation] accepted run metadata could not be persisted", { runId: result.runId });
      }
      console.info("[temporary Apify validation] dispatch accepted", { runId: result.runId, targetCount: targets.length });
    }, async error => {
        const code = safeFailureCode(error);
        try {
          await db.update(appSettings)
            .set({ value: `failed:${code}`, updatedAt: new Date() })
            .where(eq(appSettings.key, RUNNER_MARKER_KEY));
        } catch {
          // Keep the atomic one-shot claim even if optional result metadata cannot be written.
        }
        console.error("[temporary Apify validation] dispatch failed", { code });
    });
    registerBackgroundTask(task, "temporary-apify-validation");
    return res.status(202).json({ accepted: true, targetCount: targets.length });
  } catch {
    return res.status(503).json({ error: "temporary_apify_validation_unavailable" });
  }
}

export const temporaryApifyValidationAuthConfig = { tokenEnvKey: TOKEN_ENV_KEY, markerKey: RUNNER_MARKER_KEY } as const;
