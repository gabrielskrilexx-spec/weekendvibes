import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { hasValidInternalCronSecret } from "./_core/cron-auth.js";
import { sdk } from "./_core/sdk.js";
import { HttpError } from "../shared/_core/errors.js";
import { redactError } from "./_core/security.js";
import { recoverOrphanedExportJobs, purgePersistentExportJobs, evaluateExportJobsOperationalAlerts, listPendingFileDeleteQueue } from "./filtered-story-export-jobs.js";
import { evaluateHeartbeatHealth, recordHeartbeatExecutionEvent } from "./heartbeat-observability.js";

export async function exportJobsRecoveryHandler(req: Request, res: Response) {
  const startedAt = Date.now();
  let heartbeatExecutionId = req.header("x-heartbeat-execution-id") ?? req.header("x-task-uid") ?? null;
  const recordEventSafely = async (event: Parameters<typeof recordHeartbeatExecutionEvent>[0]) => {
    try { await recordHeartbeatExecutionEvent(event); } catch (error) { console.warn("[Heartbeat] event persistence skipped", error instanceof Error ? error.message : "unknown error"); }
  };
  try {
    heartbeatExecutionId = heartbeatExecutionId ?? `heartbeat-${Date.now()}-${randomUUID()}`;
    await recordEventSafely({ heartbeatExecutionId, eventType: "started", sequence: 0, status: "running", message: "Execução M2M de recuperação iniciada." });
    if (!hasValidInternalCronSecret(req)) {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user.isCron) return res.status(403).json({ success: false, error: "cron-only" });
        heartbeatExecutionId = heartbeatExecutionId ?? user.taskUid ?? null;
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 403) return res.status(403).json({ success: false, error: "cron-only" });
        console.error("[ExportRecovery] authentication failed", redactError(error));
        return res.status(500).json({ success: false, error: "authentication-failed" });
      }
    }
    const recovered = await recoverOrphanedExportJobs(5);
    await recordEventSafely({ heartbeatExecutionId, eventType: "step", sequence: 1, status: "recovered", message: `Recuperação concluída: ${recovered.recovered} jobs retomados.`, metadata: { recovered: recovered.recovered, skipped: recovered.skipped } });
    const purged = await purgePersistentExportJobs();
    await recordEventSafely({ heartbeatExecutionId, eventType: "step", sequence: 2, status: "purged", message: `Limpeza lógica concluída: ${purged.deletedJobs} jobs removidos.`, metadata: { deletedJobs: purged.deletedJobs, pendingFiles: purged.pendingFiles } });
    const observability = await evaluateExportJobsOperationalAlerts(24, heartbeatExecutionId);
    const pendingDeletion = await listPendingFileDeleteQueue(50);
    const durationMs = Date.now() - startedAt;
    await recordEventSafely({ heartbeatExecutionId, eventType: "completed", sequence: 3, durationMs, status: "succeeded", message: "Execução M2M concluída com sucesso." });
    try { await evaluateHeartbeatHealth({ heartbeatExecutionId, status: "succeeded", durationMs }); } catch (error) { console.warn("[Heartbeat] health evaluation skipped", error instanceof Error ? error.message : "unknown error"); }
    return res.status(200).json({ success: true, heartbeatExecutionId, recovered: recovered.recovered, skipped: recovered.skipped, purged: { deletedJobs: purged.deletedJobs, pendingFiles: purged.pendingFiles }, pendingDeletion: pendingDeletion.length, metrics: observability.metrics, alerts: observability.alerts, checkedAt: new Date().toISOString() });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const failedExecutionId = heartbeatExecutionId ?? `heartbeat-failed-${Date.now()}-${randomUUID()}`;
    console.error("[ExportRecovery] failed", redactError(error));
    await recordEventSafely({ heartbeatExecutionId: failedExecutionId, eventType: "failed", sequence: 3, durationMs, status: "failed", message: "A recuperação das exportações falhou." });
    try { await evaluateHeartbeatHealth({ heartbeatExecutionId: failedExecutionId, status: "failed", durationMs, errorMessage: error instanceof Error ? error.message : null }); } catch (healthError) { console.warn("[Heartbeat] failure evaluation skipped", healthError instanceof Error ? healthError.message : "unknown error"); }
    return res.status(500).json({ success: false, heartbeatExecutionId: failedExecutionId, error: "export-recovery-failed", message: "A recuperação das exportações falhou; será tentada novamente no próximo Heartbeat." });
  }
}
