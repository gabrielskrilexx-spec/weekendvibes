import type { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { ingestionRuns, events } from "../drizzle/schema";
import { deleteExpiredEvents, getDb, purgeResolvedOperationalAlerts } from "./db";
import { sdk } from "./_core/sdk";
import { HttpError } from "@shared/_core/errors";
import { evaluateCriticalFreshnessAlerts, finishIngestionRun, startIngestionRun } from "./ingestion-reports";
import { redactError } from "./_core/security";
import { hasValidInternalCronSecret } from "./_core/cron-auth";

const MONITORED_ROUTINES = ["full-agenda", "instagram-agenda", "scheduled-instagram"] as const;
const MAX_HEARTBEAT_AGE_MS = 26 * 60 * 60 * 1000;

function errorPayload(error: unknown, startedAt: string) {
  return {
    ok: false,
    error: "internal_error",
    errorClass: redactError(error).name,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

export async function heartbeatMonitorHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  let monitorRunId: number | undefined;
  try {
    let taskUid: string;
    if (hasValidInternalCronSecret(req)) {
      taskUid = "internal-cron";
    } else {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 403) return res.status(403).json({ error: "cron-only" });
        console.error("[HeartbeatMonitor] failed", redactError(error));
        return res.status(500).json(errorPayload(error, startedAt));
      }
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      taskUid = user.taskUid;
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ ok: false, error: "database-unavailable", startedAt, finishedAt: new Date().toISOString() });

    monitorRunId = await startIngestionRun({ routine: "heartbeat-monitor", sourceKey: "heartbeat-direct" });
    const expiredRemoved = await deleteExpiredEvents(db);
    const purgedResolvedAlerts = await purgeResolvedOperationalAlerts(30, new Date(), db);
    const freshnessAlerts = await evaluateCriticalFreshnessAlerts(db);
    console.info(`[HeartbeatMonitor] expired_events_removed=${expiredRemoved} resolved_alerts_purged=${purgedResolvedAlerts.purgedCount} freshness_alerts=${freshnessAlerts.triggered}`);
    const latestRuns = await db.select().from(ingestionRuns)
      .where(sql`${ingestionRuns.routine} IN (${sql.join(MONITORED_ROUTINES.map(routine => sql`${routine}`), sql`, `)})`)
      .orderBy(desc(ingestionRuns.startedAt)).limit(10);
    const latest = latestRuns[0];
    const now = Date.now();
    const latestFinishedAt = latest?.finishedAt ? new Date(latest.finishedAt).getTime() : 0;
    const isRecent = latestFinishedAt > 0 && now - latestFinishedAt <= MAX_HEARTBEAT_AGE_MS;
    const [persisted] = await db.select({ count: sql<number>`count(*)` }).from(events).where(and(eq(events.isPublished, 1), eq(events.isArchived, 0)));
    const persistedEventCount = Number(persisted?.count ?? 0);
    const healthy = Boolean(latest && latest.status === "succeeded" && isRecent);
    const snapshot = {
      taskUid,
      healthy,
      latestRun: latest ? { id: latest.id, routine: latest.routine, status: latest.status, importedCount: latest.importedCount, failedCount: latest.failedCount, finishedAt: latest.finishedAt } : null,
      latestRunAgeMs: latestFinishedAt ? Math.max(0, now - latestFinishedAt) : null,
      persistedPublishedEvents: persistedEventCount,
      expiredRemoved,
      purgedResolvedAlerts,
      freshnessAlerts,
      timezone: "America/Sao_Paulo",
      checkedAt: new Date().toISOString(),
    };
    await finishIngestionRun(monitorRunId, { status: healthy ? "succeeded" : "partial", details: snapshot });
    return res.status(healthy ? 200 : 200).json({ ok: true, ...snapshot, monitorRunId, startedAt, finishedAt: new Date().toISOString() });
  } catch (error) {
    await finishIngestionRun(monitorRunId, { status: "failed", failedCount: 1, details: { error: redactError(error) } });
    console.error("[HeartbeatMonitor] failed", redactError(error));
      return res.status(500).json(errorPayload(error, startedAt));
  }
}
