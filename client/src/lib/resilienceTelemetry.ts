const CONSENT_KEY = "weekendvibes-cookie-consent";
const COUNTER_KEY = "weekendvibes-resilience-counters";

type ResilienceEvent =
  | "map_fallback_list"
  | "map_retry_scheduled"
  | "map_retry_success"
  | "map_retry_failure"
  | "ingestion_retry";

type ResilienceCounters = Partial<Record<ResilienceEvent, number>>;

type Umami = { track?: (event: string, data?: Record<string, string | number>) => void };

declare global {
  interface Window { umami?: Umami; }
}

function hasAnalyticsConsent() {
  try { return window.localStorage.getItem(CONSENT_KEY) === "accepted"; } catch { return false; }
}

function incrementCounter(event: ResilienceEvent) {
  try {
    const current = JSON.parse(window.localStorage.getItem(COUNTER_KEY) ?? "{}") as ResilienceCounters;
    current[event] = (current[event] ?? 0) + 1;
    window.localStorage.setItem(COUNTER_KEY, JSON.stringify(current));
  } catch {
    // Storage pode estar indisponível; a telemetria não pode interromper a UX.
  }
}

export function trackResilienceEvent(event: ResilienceEvent, data: Record<string, string | number> = {}) {
  if (typeof window === "undefined") return;
  incrementCounter(event);
  const payload = { event, ...data };
  if (hasAnalyticsConsent()) window.umami?.track?.(`weekendvibes_${event}`, payload);
  console.info("[Resilience]", JSON.stringify(payload));
}

export function readResilienceCounters(): ResilienceCounters {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(COUNTER_KEY) ?? "{}"); } catch { return {}; }
}
