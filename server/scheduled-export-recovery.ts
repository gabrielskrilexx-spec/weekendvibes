import type { Request, Response } from "express";
import { hasValidInternalCronSecret } from "./_core/cron-auth";
import { sdk } from "./_core/sdk";
import { HttpError } from "@shared/_core/errors";
import { redactError } from "./_core/security";
import { recoverOrphanedExportJobs, purgePersistentExportJobs, evaluateExportJobsOperationalAlerts, listPendingFileDeleteQueue } from "./filtered-story-export-jobs";

export async function exportJobsRecoveryHandler(req: Request, res: Response) {
  try {
    let heartbeatExecutionId = req.header("x-heartbeat-execution-id") ?? req.header("x-task-uid") ?? null;
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
    const purged = await purgePersistentExportJobs();
    const observability = await evaluateExportJobsOperationalAlerts(24, heartbeatExecutionId ?? undefined);
    const pendingDeletion = await listPendingFileDeleteQueue(50);
    return res.status(200).json({ success: true, recovered: recovered.recovered, skipped: recovered.skipped, purged: { deletedJobs: purged.deletedJobs, pendingFiles: purged.pendingFiles }, pendingDeletion: pendingDeletion.length, metrics: observability.metrics, alerts: observability.alerts, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[ExportRecovery] failed", redactError(error));
    return res.status(500).json({ success: false, error: "export-recovery-failed", message: "A recuperação das exportações falhou; será tentada novamente no próximo Heartbeat." });
  }
}
