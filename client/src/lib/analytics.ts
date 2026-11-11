export type WebAnalyticsEvent = "page_view" | "pwa_install" | "push_enabled" | "push_disabled" | "offline_enter" | "offline_exit";

const ALLOWED_EVENTS = new Set<WebAnalyticsEvent>(["page_view", "pwa_install", "push_enabled", "push_disabled", "offline_enter", "offline_exit"]);

export function trackWebAnalytics(event: WebAnalyticsEvent, pathname?: string) {
  if (typeof window === "undefined" || !ALLOWED_EVENTS.has(event)) return;
  const candidate = pathname ?? window.location.pathname;
  const safePath = /^\/[A-Za-z0-9/_~.-]{0,180}$/.test(candidate) ? candidate : "/";
  const payload = JSON.stringify({ event, path: safePath });
  try {
    const body = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/analytics", body)) return;
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
  } catch {
    // Analytics is best-effort and must never block the user experience.
  }
}
