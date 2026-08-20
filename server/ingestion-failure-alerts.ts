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

type AlertDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type AlertTransaction = Parameters<Parameters<AlertDb["transaction"]>[0]>[0];
type AlertExecutor = Pick<AlertTransaction, "select" | "insert">;

function clean(value: string | number | null | undefined, max = 240) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
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
  if (shouldNotify && notify) {
    await notify({ fingerprint: alert.fingerprint, integration: alert.integration, severity: alert.severity, title: alert.title, message: alert.message, runId: alert.runId });
  }
  return { fingerprint: alert.fingerprint, notified: shouldNotify && Boolean(notify), reopened: state.reopened, deduplicated: state.deduplicated };
}
