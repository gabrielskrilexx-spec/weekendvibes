import type { SystemHealthStatus } from "./observability";

export type HealthTransitionNotification = {
  previousStatus: SystemHealthStatus | null;
  nextStatus: SystemHealthStatus;
  reason: string;
  observedAt: string;
};

function getWebhookUrl() {
  const raw = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function postAlertWebhook(payload: Record<string, unknown>, fetchImpl: typeof fetch = fetch) {
  const url = getWebhookUrl();
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
    console.warn("[AlertWebhook] delivery failed", error instanceof Error ? error.message : String(error));
    return { delivered: false, skipped: false } as const;
  } finally {
    clearTimeout(timeout);
  }
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
