import { listCircuitBreakerStatuses, recordOperationalAlert } from "./db";
import { redactError } from "./_core/security";

export type ScheduledIngestionStatus = "succeeded" | "partial" | "failed";

export async function observeScheduledIngestion(input: {
  routine: "public-agenda" | "instagram-agenda";
  status: ScheduledIngestionStatus;
  startedAtMs: number;
  runId?: number | string;
}) {
  const durationMs = Math.max(0, Date.now() - input.startedAtMs);
  const alerts: string[] = [];

  if (input.status === "partial" || input.status === "failed") {
    console.warn("[Scheduled observability] degraded ingestion", {
      routine: input.routine,
      status: input.status,
      durationMs,
      runId: input.runId ?? null,
    });
  }

  if (durationMs > 45_000) {
    alerts.push("duration_exceeded");
    console.warn("[Scheduled observability] duration exceeded 45 seconds", {
      routine: input.routine,
      durationMs,
      runId: input.runId ?? null,
    });
    try {
      await recordOperationalAlert({
        integration: "pipeline",
        alertType: "scheduled_duration_exceeded",
        severity: input.status === "failed" ? "CRITICAL" : "WARNING",
        title: `Cron ${input.routine} excedeu 45 segundos`,
        message: `A rotina ${input.routine} levou ${durationMs} ms para concluir.`,
        runId: input.runId,
      });
    } catch (error) {
      console.warn("[Scheduled observability] duration alert failed", redactError(error));
    }
  }

  try {
    const statuses = await listCircuitBreakerStatuses();
    const openSources = statuses.filter(source => source.circuitState === "open");
    if (openSources.length > 0) {
      alerts.push("circuit_breaker_open");
      const sourceKeys = openSources.slice(0, 20).map(source => source.sourceKey);
      console.warn("[Scheduled observability] circuit breakers open", {
        routine: input.routine,
        count: openSources.length,
        sourceKeys,
        runId: input.runId ?? null,
      });
      await recordOperationalAlert({
        integration: "pipeline",
        alertType: "scheduled_circuit_breaker_open",
        severity: "WARNING",
        title: `Circuit Breaker aberto durante ${input.routine}`,
        message: `${openSources.length} fonte(s) estão em OPEN: ${sourceKeys.join(", ")}`,
        runId: input.runId,
      });
    }
  } catch (error) {
    console.warn("[Scheduled observability] circuit status check failed", redactError(error));
  }

  return { durationMs, alerts };
}
