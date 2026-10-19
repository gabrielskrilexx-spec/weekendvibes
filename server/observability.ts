export type ObservabilityRun = {
  status: string;
  startedAt: Date | string;
  httpStatus?: number | null;
  details?: string | null;
  counts?: string | null;
};

export type TelemetryPoint = {
  date: string;
  waf: number;
  meta110: number;
  network: number;
  succeeded: number;
  total: number;
  successRate: number;
};

export type ObservabilityPeriod = 7 | 14 | 30;
export type SystemHealthStatus = "healthy" | "degraded" | "critical";

export function normalizeObservabilityPeriod(value: number): ObservabilityPeriod {
  return value === 7 || value === 30 ? value : 14;
}

export function calculateTrend(current: number, previous: number) {
  const delta = current - previous;
  const percentage = previous === 0 ? (current === 0 ? 0 : 100) : Number(((delta / previous) * 100).toFixed(1));
  return { current, previous, delta, percentage, direction: delta === 0 ? "flat" as const : delta > 0 ? "up" as const : "down" as const };
}

function classifyRun(run: ObservabilityRun) {
  const text = `${run.details ?? ""} ${run.counts ?? ""}`.toLowerCase();
  const waf = /waf|cloudflare|akamai|bloqueado/.test(text) || run.httpStatus === 403;
  const meta110 = /code 110|invalid user id|id inválido/.test(text);
  const network = /timeout|timed out|network|rede|econn|socket|fetch failed/.test(text) || run.httpStatus === 408 || run.httpStatus === 504;
  return { waf, meta110, network };
}

export function buildDailyTelemetrySeries(runs: ObservabilityRun[], now = new Date(), days = 14): TelemetryPoint[] {
  const safeDays = normalizeObservabilityPeriod(days);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - safeDays + 1));
  const points = Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    return { date: date.toISOString().slice(0, 10), waf: 0, meta110: 0, network: 0, succeeded: 0, total: 0, successRate: 0 };
  });
  const byDate = new Map(points.map(point => [point.date, point]));
  for (const run of runs) {
    const date = new Date(run.startedAt).toISOString().slice(0, 10);
    const point = byDate.get(date);
    if (!point) continue;
    point.total += 1;
    if (run.status === "succeeded") point.succeeded += 1;
    const category = classifyRun(run);
    if (category.waf) point.waf += 1;
    if (category.meta110) point.meta110 += 1;
    if (category.network) point.network += 1;
  }
  for (const point of points) point.successRate = point.total === 0 ? 0 : Number(((point.succeeded / point.total) * 100).toFixed(1));
  return points;
}

export function summarizeTelemetryTrend(series: TelemetryPoint[], periodDays = 7) {
  const split = Math.max(0, series.length - periodDays);
  const current = series.slice(split);
  const previous = series.slice(Math.max(0, split - periodDays), split);
  const sum = (items: TelemetryPoint[], key: "waf" | "meta110" | "network" | "succeeded" | "total") => items.reduce((total, point) => total + point[key], 0);
  const rate = (items: TelemetryPoint[]) => {
    const total = sum(items, "total");
    return total === 0 ? 0 : Number(((sum(items, "succeeded") / total) * 100).toFixed(1));
  };
  return {
    waf: calculateTrend(sum(current, "waf"), sum(previous, "waf")),
    meta110: calculateTrend(sum(current, "meta110"), sum(previous, "meta110")),
    network: calculateTrend(sum(current, "network"), sum(previous, "network")),
    succeeded: calculateTrend(sum(current, "succeeded"), sum(previous, "succeeded")),
    successRate: calculateTrend(rate(current), rate(previous)),
  };
}

export function calculateSystemHealthStatus(input: { openSources: number; activeSources: number; recentRuns: number; recentFailures: number }): SystemHealthStatus {
  const openRate = input.activeSources > 0 ? input.openSources / input.activeSources : 0;
  const failureRate = input.recentRuns > 0 ? input.recentFailures / input.recentRuns : 0;
  const rate = Math.max(openRate, failureRate);
  if (rate >= 0.6) return "critical";
  if (rate > 0.3) return "degraded";
  return "healthy";
}
