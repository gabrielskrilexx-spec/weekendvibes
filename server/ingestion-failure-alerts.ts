import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { operationalAlerts } from "../drizzle/schema";
import { getDb, type OperationalIntegration, type OperationalSeverity } from "./db";

export type IngestionFailureInput = {
  routine: string;
  sourceKey?: string | null;
  integration: OperationalIntegration;
  status?: number | null;
  errorCode?: string | number | null;
  message: string;
  severity?: OperationalSeverity;
  alertType?: string;
  runId?: number | string | null;
  slaMinutes?: number;
  now?: Date;
};

export type IngestionFailureNotification = {
  fingerprint: string;
  integration: OperationalIntegration;
  severity: OperationalSeverity;
  title: string;
  message: string;
  runId: string | null;
};

export type IngestionFailureAlertResult = {
  fingerprint: string;
  notified: boolean;
  reopened: boolean;
  deduplicated: boolean;
};

const consecutiveWebhookNotifications = new Set<string>();
const BLOCKED_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const BLOCKED_WEBHOOK_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const blockedFailureCounts = new Map<string, { count: number; windowStartedAt: number }>();
const blockedWebhookCooldownUntil = new Map<string, number>();

type BlockedSourceStatus = 403 | 502 | 504;

export async function notifyRepeatedBlockedSourceWebhook(input: { sourceKey: string; routine: string; status: BlockedSourceStatus; message: string }, fetcher: typeof fetch = fetch) {
  const endpoint = process.env.CRITICAL_ALERT_WEBHOOK_URL?.trim();
  const key = `${clean(input.routine, 64)}|${clean(input.sourceKey, 120)}|${input.status}`;
  const now = Date.now();
  const previous = blockedFailureCounts.get(key);
  const withinWindow = previous && now - previous.windowStartedAt <= BLOCKED_FAILURE_WINDOW_MS;
  const state = withinWindow ? { count: previous.count + 1, windowStartedAt: previous.windowStartedAt } : { count: 1, windowStartedAt: now };
  blockedFailureCounts.set(key, state);
  const cooldownUntil = blockedWebhookCooldownUntil.get(key) ?? 0;
  if (!endpoint || state.count < 3 || cooldownUntil > now) return { sent: false, skipped: true, count: state.count } as const;
  let parsed: URL;
  try { parsed = new URL(endpoint); if (parsed.protocol !== "https:") return { sent: false, skipped: true, count: state.count } as const; } catch { return { sent: false, skipped: true, count: state.count } as const; }
  const payload = { alert: "scraping_blocked", sourceKey: clean(input.sourceKey, 120), routine: clean(input.routine, 64), status: input.status, category: input.status === 403 ? "anti_bot_or_waf" : "proxy_gateway", consecutiveFailures: state.count, occurredAt: new Date().toISOString(), message: clean(input.message, 240) };
  try {
    const response = await fetcher(parsed.toString(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) return { sent: false, skipped: false, count: state.count } as const;
    blockedWebhookCooldownUntil.set(key, now + BLOCKED_WEBHOOK_COOLDOWN_MS);
    return { sent: true, skipped: false, count: state.count } as const;
  } catch { return { sent: false, skipped: false, count: state.count } as const; }
}

export function resetBlockedSourceFailureCountersForTest() { blockedFailureCounts.clear(); blockedWebhookCooldownUntil.clear(); }


export type ConsecutiveFailureWebhookInput = {
  routine: string;
  count: number;
  runIds: number[];
  latestStartedAt: string;
  message?: string;
};

export async function notifyConsecutiveFailureWebhook(input: ConsecutiveFailureWebhookInput, fetcher: typeof fetch = fetch) {
  const endpoint = process.env.CRITICAL_ALERT_WEBHOOK_URL?.trim();
  if (!endpoint) return { sent: false, skipped: true } as const;
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
    if (parsed.protocol !== "https:") return { sent: false, skipped: true } as const;
  } catch {
    return { sent: false, skipped: true } as const;
  }
  const fingerprint = `${clean(input.routine, 64)}|${input.runIds.slice(0, 3).map(id => Number(id)).join(",")}`;
  if (consecutiveWebhookNotifications.has(fingerprint)) return { sent: false, skipped: true } as const;
  const payload = {
    alert: "consecutive_ingestion_failures",
    routine: clean(input.routine, 64),
    count: Math.max(2, Math.min(Number(input.count) || 0, 1000)),
    runIds: input.runIds.slice(0, 10).map(id => Number(id)).filter(Number.isSafeInteger),
    occurredAt: new Date().toISOString(),
    latestStartedAt: clean(input.latestStartedAt, 40),
    message: clean(input.message ?? `A rotina ${input.routine} registrou falhas consecutivas após esgotar os retries.`, 500),
  };
  try {
    const response = await fetcher(parsed.toString(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) return { sent: false, skipped: false } as const;
    consecutiveWebhookNotifications.add(fingerprint);
    return { sent: true, skipped: false } as const;
  } catch {
    return { sent: false, skipped: false } as const;
  }
}

type AlertDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type AlertTransaction = Parameters<Parameters<AlertDb["transaction"]>[0]>[0];
type AlertExecutor = Pick<AlertTransaction, "select" | "insert">;

function clean(value: string | number | null | undefined, max = 240) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").replace(/\b(access[_-]?token|api[_-]?key|token|secret|password)\s*[:=]\s*[^\s;,]+/gi, "$1=[redacted]").trim().slice(0, max);
}

function safeRunId(value: number | string | null | undefined) {
  const normalized = clean(value, 32).replace(/[^a-zA-Z0-9_-]/g, "");
  return normalized || null;
}

export function buildIngestionFailureFingerprint(input: Pick<IngestionFailureInput, "routine" | "sourceKey" | "integration" | "status" | "errorCode" | "message">) {
  const canonical = [
    clean(input.integration, 32).toLowerCase(),
    clean(input.routine, 64).toLowerCase(),
    clean(input.sourceKey, 120).toLowerCase(),
    clean(input.status, 12),
    clean(input.errorCode, 32).toLowerCase(),
    clean(input.message, 500).toLowerCase(),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildIngestionFailureAlert(input: IngestionFailureInput) {
  const severity = input.severity ?? "CRITICAL";
  const routine = clean(input.routine, 64);
  const sourceKey = clean(input.sourceKey, 120) || "unknown";
  const status = input.status == null ? "unknown" : String(input.status);
  const errorCode = clean(input.errorCode, 32);
  const message = clean(input.message, 2000) || "Falha não especificada na ingestão.";
  return {
    fingerprint: buildIngestionFailureFingerprint(input),
    integration: input.integration,
    severity,
    alertType: clean(input.alertType, 80) || "ingestion_failure",
    slaMinutes: Math.min(Math.max(Math.round(input.slaMinutes ?? (severity === "CRITICAL" ? 60 : 240)), 5), 10080),
    runId: safeRunId(input.runId),
    title: `Falha na ingestão ${routine}`.slice(0, 180),
    message: `${message} (routine=${routine}; source=${sourceKey}; http=${status}${errorCode ? `; code=${errorCode}` : ""})`.slice(0, 20000),
  };
}

export async function handleIngestionFailureAlert(
  input: IngestionFailureInput,
  options: {
    dbOverride?: AlertDb;
    notify?: (notification: IngestionFailureNotification) => Promise<void>;
  } = {},
): Promise<IngestionFailureAlertResult> {
  const db = options.dbOverride ?? await getDb();
  if (!db) return { fingerprint: buildIngestionFailureFingerprint(input), notified: false, reopened: false, deduplicated: false };

  const alert = buildIngestionFailureAlert(input);
  const notify = options.notify;
  const execute = async (tx: AlertExecutor) => {
    const [existing] = await tx.select({ id: operationalAlerts.id, isResolved: operationalAlerts.isResolved })
      .from(operationalAlerts)
      .where(eq(operationalAlerts.fingerprint, alert.fingerprint))
      .limit(1);
    const reopened = existing?.isResolved === 1;
    const deduplicated = Boolean(existing && !reopened);
    await tx.insert(operationalAlerts).values({ ...alert, isResolved: 0 }).onDuplicateKeyUpdate({
      set: { severity: alert.severity, alertType: alert.alertType, slaMinutes: alert.slaMinutes, runId: alert.runId, title: alert.title, message: alert.message, isResolved: 0, updatedAt: input.now ?? new Date() },
    });
    return { reopened, deduplicated };
  };

  const state = typeof db.transaction === "function" ? await db.transaction(execute) : await execute(db as unknown as AlertExecutor);
  const shouldNotify = !state.deduplicated;
  if ((input.status === 403 || input.status === 502 || input.status === 504) && input.sourceKey) {
    await notifyRepeatedBlockedSourceWebhook({ sourceKey: input.sourceKey, routine: input.routine, status: input.status, message: input.message });
  }
  if (shouldNotify && notify) {
    await notify({ fingerprint: alert.fingerprint, integration: alert.integration, severity: alert.severity, title: alert.title, message: alert.message, runId: alert.runId });
  }
  return { fingerprint: alert.fingerprint, notified: shouldNotify && Boolean(notify), reopened: state.reopened, deduplicated: state.deduplicated };
}

export type IngestionSummaryWebhookInput = {
  routine: string;
  status: "succeeded" | "partial" | "failed";
  startedAt: string;
  finishedAt: string;
  added: number;
  updated: number;
  ignored: number;
  errors: Array<{ sourceKey: string; status: number | null; message: string }>;
  sources: Array<{ sourceKey: string; read: number; added: number; updated: number; ignored: number; errors: number }>;
};

export async function notifyIngestionSummary(input: IngestionSummaryWebhookInput, fetcher: typeof fetch = fetch) {
  const endpoint = process.env.CRITICAL_ALERT_WEBHOOK_URL?.trim();
  if (!endpoint) return { sent: false, skipped: true } as const;
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
    if (parsed.protocol !== "https:") return { sent: false, skipped: true } as const;
  } catch {
    return { sent: false, skipped: true } as const;
  }
  const payload = {
    alert: "ingestion_summary",
    routine: clean(input.routine, 64),
    status: input.status,
    startedAt: clean(input.startedAt, 40),
    finishedAt: clean(input.finishedAt, 40),
    added: Math.max(0, Math.min(Number(input.added) || 0, 100000)),
    updated: Math.max(0, Math.min(Number(input.updated) || 0, 100000)),
    ignored: Math.max(0, Math.min(Number(input.ignored) || 0, 100000)),
    errors: input.errors.slice(0, 20).map(error => ({
      sourceKey: clean(error.sourceKey, 120),
      status: error.status == null ? null : Number(error.status),
      message: clean(error.message, 240),
    })),
    sources: input.sources.slice(0, 50).map(source => ({
      sourceKey: clean(source.sourceKey, 120),
      read: Math.max(0, Number(source.read) || 0),
      added: Math.max(0, Number(source.added) || 0),
      updated: Math.max(0, Number(source.updated) || 0),
      ignored: Math.max(0, Number(source.ignored) || 0),
      errors: Math.max(0, Number(source.errors) || 0),
    })),
  };
  try {
    const response = await fetcher(parsed.toString(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return response.ok ? { sent: true, skipped: false } as const : { sent: false, skipped: false } as const;
  } catch {
    return { sent: false, skipped: false } as const;
  }
}
