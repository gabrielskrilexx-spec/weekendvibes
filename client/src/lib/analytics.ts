export type WebAnalyticsEvent = "page_view" | "pwa_install" | "push_enabled" | "push_disabled" | "offline_enter" | "offline_exit" | "event_share_clicked" | "ticket_cta_clicked";

const ALLOWED_EVENTS = new Set<WebAnalyticsEvent>(["page_view", "pwa_install", "push_enabled", "push_disabled", "offline_enter", "offline_exit", "event_share_clicked", "ticket_cta_clicked"]);

export function trackWebAnalytics(event: WebAnalyticsEvent, pathname?: string) {
  if (typeof window === "undefined" || !ALLOWED_EVENTS.has(event)) return;
  const candidate = pathname ?? window.location.pathname;
  const safePath = /^\/[A-Za-z0-9/_~.-]{0,180}$/.test(candidate) ? candidate : "/";
  const payload = JSON.stringify({ event, path: safePath });
  try {
    const body = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/analytics", body)) return;
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
  } catch { /* best effort */ }
}

export function trackEngagement(input: { eventType: "event_share_clicked" | "ticket_cta_clicked"; eventId?: number; venueSlug?: string; channel?: "native" | "clipboard"; source?: "card" | "detail" | "mobile_bar" }) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ event: input.eventType, path: window.location.pathname, ...input });
  try { void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined); } catch { /* best effort */ }
}
