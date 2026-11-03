import { and, eq } from "drizzle-orm";
import { appSettings, ingestionRuns } from "../drizzle/schema";
import { getApifyDailyUsageStatus, getDb, isApifyIngestionKillSwitchEnabled } from "./db";
import { registerBackgroundTask } from "./background-tasks";
import { startAsyncApifyStoriesRun } from "./apify-async";

const RUNNER_MARKER_KEY = "temporary_apify_validation_runner_used_20261103_retry3";
const TARGET = { username: "plantssantos" } as const;

function safeFailureCode(error: unknown) {
  const status = error && typeof error === "object" ? (error as { apifyStatus?: unknown }).apifyStatus : undefined;
  if (status === 400 || status === 404) return `apify_http_${status}`;
  if (error instanceof Error && /quota|limite diário|budget/i.test(error.message)) return "budget_blocked";
  return "dispatch_failed";
}

export async function temporaryApifyValidationRunnerHandler(req: any, res: any) {
  if (req.headers["transfer-encoding"] !== undefined || Number(req.headers["content-length"] ?? 0) !== 0 || (req.body && Object.keys(req.body).length > 0)) {
    return res.status(400).json({ error: "empty_body_required" });
  }
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "database_unavailable" });
  if (!process.env.APIFY_API_TOKEN?.trim() || !process.env.SCHEDULED_TASK_ENDPOINT_BASE?.trim()) return res.status(503).json({ error: "apify_runtime_configuration_unavailable" });
  try {
    if (await isApifyIngestionKillSwitchEnabled(db)) return res.status(409).json({ error: "apify_kill_switch_active" });
    const usage = await getApifyDailyUsageStatus({ dbOverride: db });
    if (!usage.persistence || usage.remaining < 1) return res.status(409).json({ error: "apify_budget_unavailable_or_insufficient", requiredUnits: 1, remainingUnits: usage.persistence ? usage.remaining : null });
    const activeRuns = await db.select({ id: ingestionRuns.id }).from(ingestionRuns).where(and(eq(ingestionRuns.routine, "instagram-stories-async"), eq(ingestionRuns.status, "running"))).limit(1);
    if (activeRuns.length > 0) return res.status(409).json({ error: "instagram_apify_run_already_active" });
    const claim = await db.insert(appSettings).values({ key: RUNNER_MARKER_KEY, value: `claimed:${new Date().toISOString()}` }).onConflictDoNothing().returning({ key: appSettings.key });
    if (claim.length === 0) return res.status(409).json({ error: "runner_already_used" });
    const dispatch = startAsyncApifyStoriesRun({ trigger: "manual", targets: [TARGET] });
    const task = dispatch.then(async result => {
      try { await db.update(appSettings).set({ value: `accepted:${result.runId}`, updatedAt: new Date() }).where(eq(appSettings.key, RUNNER_MARKER_KEY)); } catch { /* claim remains authoritative */ }
      console.info("[temporary Apify validation] dispatch accepted", { runId: result.runId, target: TARGET.username });
    }, async error => {
      const code = safeFailureCode(error);
      try { await db.update(appSettings).set({ value: `failed:${code}`, updatedAt: new Date() }).where(eq(appSettings.key, RUNNER_MARKER_KEY)); } catch { /* preserve claim */ }
      console.error("[temporary Apify validation] dispatch failed", { code });
    });
    registerBackgroundTask(task, "temporary-apify-validation");
    return res.status(202).json({ accepted: true, target: TARGET.username, targetCount: 1, maximumUnits: 14 });
  } catch {
    return res.status(503).json({ error: "temporary_apify_validation_unavailable" });
  }
}
