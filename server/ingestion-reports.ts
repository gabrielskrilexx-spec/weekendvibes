import { and, desc, eq, sql } from "drizzle-orm";
import { ingestionRuns, operationalAlerts } from "../drizzle/schema";
import { getDb, recordOperationalAlert } from "./db";

export function isCriticalIngestionFailure(details: unknown) {
  const text = typeof details === "string" ? details : JSON.stringify(details ?? "");
  return /timeout|http\s*5\d{2}|status\s*5\d{2}|\b5\d{2}\b/i.test(text);
}

export async function startIngestionRun(input: { routine: string; sourceKey?: string }) {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db.insert(ingestionRuns).values({ routine: input.routine.slice(0, 64), sourceKey: input.sourceKey?.slice(0, 255), status: "running" });
    return Number(result[0].insertId);
  } catch (error) {
    console.warn("[Ingestion reports] Could not start run record:", error);
    return undefined;
  }
}

export async function finishIngestionRun(id: number | undefined, input: { status: "succeeded" | "failed" | "partial"; importedCount?: number; failedCount?: number; details?: unknown }) {
  if (!id) return;
  try {
    const db = await getDb();
    if (!db) return;
    const serializedDetails = input.details ? JSON.stringify(input.details).slice(0, 20000) : null;
    await db.update(ingestionRuns).set({ status: input.status, importedCount: input.importedCount ?? 0, failedCount: input.failedCount ?? 0, details: serializedDetails, finishedAt: new Date() }).where(eq(ingestionRuns.id, id));
    const failureText = serializedDetails ?? "";
    if (input.status === "failed" && isCriticalIngestionFailure(failureText)) {
      await recordOperationalAlert({ dbOverride: db, integration: "pipeline", title: "Falha crítica na ingestão", message: `A rotina ${id} registrou timeout ou erro HTTP 5xx: ${failureText}` });
    }
  } catch (error) {
    console.warn("[Ingestion reports] Could not finish run record:", error);
  }
}

export async function listIngestionReport(size = 20) {
  const db = await getDb();
  if (!db) return { runs: [], alerts: [], criticalAlerts: [], sourceMetrics: [], totals: { succeeded: 0, failed: 0, partial: 0, imported: 0 } };
  const safeSize = Math.min(Math.max(size, 1), 50);
  const runs = await db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(safeSize);
  const alerts = await db.select({ id: operationalAlerts.id, integration: operationalAlerts.integration, title: operationalAlerts.title, message: operationalAlerts.message, isResolved: operationalAlerts.isResolved, createdAt: operationalAlerts.createdAt }).from(operationalAlerts).orderBy(desc(operationalAlerts.createdAt)).limit(safeSize);
  const [totals] = await db.select({ succeeded: sql<number>`sum(status = 'succeeded')`, failed: sql<number>`sum(status = 'failed')`, partial: sql<number>`sum(status = 'partial')`, imported: sql<number>`coalesce(sum(importedCount), 0)` }).from(ingestionRuns);
  const sourceRows = await db.select({ sourceKey: ingestionRuns.sourceKey, imported: sql<number>`coalesce(sum(${ingestionRuns.importedCount}), 0)`, runs: sql<number>`count(*)`, failed: sql<number>`sum(status = 'failed')` }).from(ingestionRuns).groupBy(ingestionRuns.sourceKey).orderBy(desc(sql`sum(${ingestionRuns.importedCount})`));
  const sourceMetrics = sourceRows.filter(row => row.sourceKey).map(row => ({ sourceKey: String(row.sourceKey), imported: Number(row.imported ?? 0), runs: Number(row.runs ?? 0), failed: Number(row.failed ?? 0) }));
  const criticalAlerts = alerts.filter(alert => isCriticalIngestionFailure(`${alert.title} ${alert.message}`));
  return { runs, alerts, criticalAlerts, sourceMetrics, totals: { succeeded: Number(totals?.succeeded ?? 0), failed: Number(totals?.failed ?? 0), partial: Number(totals?.partial ?? 0), imported: Number(totals?.imported ?? 0) } };
}

export async function reprocessIngestionSource(sourceKey: "public" | "instagram") {
  const active = await listIngestionReport(20);
  const running = active.runs.some(run => run.status === "running" && run.sourceKey === sourceKey);
  if (running) throw new Error("Essa fonte já está em processamento");
  const runId = await startIngestionRun({ routine: "manual-reprocess", sourceKey });
  try {
      const { runAgendaStepForScheduler } = await import("./agenda-routine");
    const result = await runAgendaStepForScheduler(sourceKey);
    const imported = Number((result as { result?: { imported?: number } })?.result?.imported ?? 0);
    await finishIngestionRun(runId, { status: "succeeded", importedCount: imported, details: result });
    return { ok: true, sourceKey, imported };
  } catch (error) {
    await finishIngestionRun(runId, { status: "failed", failedCount: 1, details: { message: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}
