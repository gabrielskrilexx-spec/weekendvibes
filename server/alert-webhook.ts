import type { SystemHealthStatus } from "./observability";

export type HealthTransitionNotification = {
  previousStatus: SystemHealthStatus | null;
  nextStatus: SystemHealthStatus;
  reason: string;
  observedAt: string;
};

function getWebhookUrl(variableName: string) {
  const raw = process.env[variableName]?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function postToWebhook(variableName: string, payload: Record<string, unknown>, fetchImpl: typeof fetch, logLabel: string) {
  const url = getWebhookUrl(variableName);
  if (!url) return { delivered: false, skipped: true } as const;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { delivered: response.ok, skipped: false, status: response.status } as const;
  } catch (error) {
    console.warn(`[${logLabel}] delivery failed`, error instanceof Error ? error.message : String(error));
    return { delivered: false, skipped: false } as const;
  } finally {
    clearTimeout(timeout);
  }
}

export function postAlertWebhook(payload: Record<string, unknown>, fetchImpl: typeof fetch = fetch) {
  return postToWebhook("ALERT_WEBHOOK_URL", payload, fetchImpl, "AlertWebhook");
}

export function postObservabilityWebhook(payload: Record<string, unknown>, fetchImpl: typeof fetch = fetch) {
  return postToWebhook("OBSERVABILITY_WEBHOOK_URL", payload, fetchImpl, "ObservabilityWebhook");
}

export async function notifyHealthTransition(transition: HealthTransitionNotification, fetchImpl: typeof fetch = fetch) {
  return postAlertWebhook({
    event: "system_health_transition",
    severity: transition.nextStatus,
    system_health_status: transition.nextStatus,
    previous_status: transition.previousStatus,
    reason: transition.reason,
    observed_at: transition.observedAt,
  }, fetchImpl);
}

export async function notifyWeeklyExecutiveReport(report: Record<string, unknown>, fetchImpl: typeof fetch = fetch) {
  return postAlertWebhook({ event: "weekly_executive_report", report }, fetchImpl);
}

export async function notifyObservabilityReport(report: Record<string, unknown>, transition?: HealthTransitionNotification, fetchImpl: typeof fetch = fetch) {
  const sources = (report.sources ?? {}) as { active?: number; open?: number; waf?: number; meta110?: number; network?: number };
  return postObservabilityWebhook({
    event: "observability_health_alert",
    system_health_status: report.system_health_status,
    previous_status: transition?.previousStatus ?? null,
    reason: transition?.reason ?? "Resumo periódico do relatório executivo",
    generated_at: report.generatedAt,
    summary: { active_sources: sources.active ?? 0, open_sources: sources.open ?? 0, waf_failures: sources.waf ?? 0, meta_code_110: sources.meta110 ?? 0, network_failures: sources.network ?? 0 },
  }, fetchImpl);
}
