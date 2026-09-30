import { and, eq, gte, inArray, like, or } from "drizzle-orm";
import { ingestionSources, operationalAlerts } from "../drizzle/schema.js";
import { getDb, resolveOperationalAlertsBefore, saoPauloDayStartUtc } from "./db.js";
import { expirePastManualReviewEvents, expireStaleManualReviewHighlights } from "./manual-review.js";

const STALE_ALERT_TYPES = ["meta_token_expired", "apify_daily_limit_reached", "reconciliation_gap", "filtered_exceeds_read"] as const;
const NOISY_SOURCE_NAMES = ["%curv%", "%flaming%"] as const;

export function getStaleAlertCutoff(now = new Date()) {
  return saoPauloDayStartUtc(now);
}

export function shouldPausePublicSource(kind: string, lastHttpStatus: number | null) {
  return kind === "public" && (lastHttpStatus === 403 || lastHttpStatus === 502);
}

export async function pausePersistentlyBlockedPublicSources(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return { pausedCount: 0, sourceKeys: [] as string[] };
  const blocked = await db.select({ sourceKey: ingestionSources.sourceKey }).from(ingestionSources).where(and(
    eq(ingestionSources.kind, "public"),
    eq(ingestionSources.isEnabled, 1),
    inArray(ingestionSources.lastHttpStatus, [403, 502]),
  ));
  const sourceKeys = blocked.map(row => row.sourceKey);
  if (sourceKeys.length > 0) {
    const nextAttemptAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(ingestionSources).set({
      circuitState: "open",
      circuitNextAttemptAt: nextAttemptAt,
      circuitLastError: "Pausa silenciosa: bloqueio HTTP persistente; nova tentativa após o cooldown.",
      lastMessage: "Fonte pausada silenciosamente após bloqueio HTTP persistente.",
      updatedAt: new Date(),
    }).where(inArray(ingestionSources.sourceKey, sourceKeys));
    await db.update(operationalAlerts).set({ isResolved: 1, updatedAt: new Date() }).where(and(
      eq(operationalAlerts.isResolved, 0),
      gte(operationalAlerts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      or(like(operationalAlerts.message, "%HTTP 403%"), like(operationalAlerts.message, "%HTTP 502%")),
    ));
  }
  return { pausedCount: sourceKeys.length, sourceKeys };
}

export async function resetNoisyInstagramSources(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return { resetCount: 0, sourceKeys: [] as string[] };
  const sources = await db.select({ sourceKey: ingestionSources.sourceKey }).from(ingestionSources).where(and(
    eq(ingestionSources.kind, "instagram"),
    or(...NOISY_SOURCE_NAMES.map(pattern => like(ingestionSources.name, pattern))),
  ));
  const sourceKeys = sources.map(row => row.sourceKey);
  if (sourceKeys.length > 0) {
    await db.update(ingestionSources).set({
      circuitState: "closed",
      circuitFailureCount: 0,
      circuitOpenedAt: null,
      circuitNextAttemptAt: null,
      circuitLastError: null,
      consecutive403Count: 0,
      last403AlertedAt: null,
      lastHttpStatus: null,
      lastFailureReason: null,
      updatedAt: new Date(),
    }).where(inArray(ingestionSources.sourceKey, sourceKeys));
  }
  return { resetCount: sourceKeys.length, sourceKeys };
}

export async function runPlatformSanitization(now = new Date(), options: { resetNoisySources?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const cutoff = saoPauloDayStartUtc(now);
  const alerts = await resolveOperationalAlertsBefore({ before: cutoff, alertTypes: [...STALE_ALERT_TYPES], dbOverride: db });
  const manualReview = await expirePastManualReviewEvents({ now, dbOverride: db });
  const staleHighlights = await expireStaleManualReviewHighlights({ now, dbOverride: db });
  const reset = options.resetNoisySources === false ? { resetCount: 0, sourceKeys: [] as string[] } : await resetNoisyInstagramSources(db);
  const paused = await pausePersistentlyBlockedPublicSources(db);
  return { cutoff: cutoff.toISOString(), alerts, manualReview: { ...manualReview, staleHighlights }, reset, paused } as const;
}

export { STALE_ALERT_TYPES };
