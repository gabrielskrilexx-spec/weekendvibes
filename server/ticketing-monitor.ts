import { setTimeout as delay } from "node:timers/promises";

export const TICKETING_MONITOR_SOURCES = [
  {
    sourceKey: "public:weticket",
    brand: "APÊ 22",
    url: "https://www.weticket.com.br/ap-22-edio-helloween-pedro-qua",
    expectedHosts: new Set(["www.weticket.com.br", "weticket.com.br"]),
  },
  {
    sourceKey: "public:zig",
    brand: "OSUCO",
    url: "https://zig.tickets/eventos/osuco-black-and-white",
    expectedHosts: new Set(["zig.tickets", "www.zig.tickets"]),
  },
] as const;

export type TicketingMonitorResult = {
  checkedAt: string;
  sourceKey: string;
  brand: string;
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  contentType: string | null;
  bytes: number;
  durationMs: number;
  status: "reachable" | "reachable_without_event_metadata" | "waf_blocked" | "rate_limited" | "http_error" | "network_error";
  detail: string;
};

export type TicketingMonitorReport = {
  monitor: "weekendvibes-ticketing-sources";
  mode: "public-read-only";
  checkedAt: string;
  results: TicketingMonitorResult[];
};

function classify(input: { status: number; body: string; error?: string }) {
  if (input.error) return { status: "network_error" as const, detail: input.error.slice(0, 240) };
  const lower = input.body.toLowerCase();
  const wafMarker = /cloudflare|attention required|access denied|akamai|waf|anti.?bot|challenge/.test(lower);
  if (input.status === 403 || (input.status === 503 && wafMarker)) return { status: "waf_blocked" as const, detail: `Bloqueado por WAF (HTTP ${input.status})` };
  if (input.status === 429) return { status: "rate_limited" as const, detail: "Limite de requisições (HTTP 429)" };
  if (input.status < 200 || input.status >= 400) return { status: "http_error" as const, detail: `HTTP ${input.status}` };
  const hasStructuredMetadata = /application\/ld\+json|og:title|__next_data__|event/.test(lower);
  return hasStructuredMetadata
    ? { status: "reachable" as const, detail: "Conteúdo público acessível" }
    : { status: "reachable_without_event_metadata" as const, detail: "HTTP OK, sem metadata de evento reconhecida" };
}

async function checkSource(source: (typeof TICKETING_MONITOR_SOURCES)[number], timeoutMs: number): Promise<TicketingMonitorResult> {
  const startedAt = Date.now();
  let response: Response | undefined;
  let body = "";
  let error: string | undefined;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(source.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "WeekendVibes-public-monitor/1.0 (+public-source-health-check)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
        },
      });
      body = await response.text();
    } finally {
      clearTimeout(timer);
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  if (response?.url) {
    try {
      const finalHost = new URL(response.url).hostname.toLowerCase();
      if (!source.expectedHosts.has(finalHost)) error = `Redirecionamento para host não esperado: ${finalHost}`;
    } catch {
      error = "URL final inválida";
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    sourceKey: source.sourceKey,
    brand: source.brand,
    url: source.url,
    finalUrl: response?.url || source.url,
    httpStatus: response?.status ?? null,
    contentType: response?.headers.get("content-type")?.split(";")[0] || null,
    bytes: Buffer.byteLength(body, "utf8"),
    durationMs: Date.now() - startedAt,
    ...classify({ status: response?.status ?? 0, body, error }),
  };
}

export async function runTicketingMonitorOnce(input: { timeoutMs?: number } = {}): Promise<TicketingMonitorReport> {
  const timeoutMs = Math.min(30_000, Math.max(3_000, input.timeoutMs ?? 15_000));
  const results = await Promise.all(TICKETING_MONITOR_SOURCES.map(source => checkSource(source, timeoutMs)));
  return { monitor: "weekendvibes-ticketing-sources", mode: "public-read-only", checkedAt: new Date().toISOString(), results };
}

export function ticketingMonitorHealthy(report: TicketingMonitorReport) {
  return report.results.every(result => result.status === "reachable" || result.status === "reachable_without_event_metadata");
}

export async function runTicketingMonitorWatch(input: { intervalMs?: number; timeoutMs?: number } = {}) {
  const intervalMs = Math.max(60_000, input.intervalMs ?? 900_000);
  while (true) {
    console.log(JSON.stringify(await runTicketingMonitorOnce({ timeoutMs: input.timeoutMs })));
    await delay(intervalMs);
  }
}
