import { describe, expect, it } from "vitest";
import { buildDailyTelemetrySeries, calculateTrend, summarizeTelemetryTrend } from "./observability";

describe("observability trends", () => {
  it("calcula comparativo percentual e direção com período anterior", () => {
    expect(calculateTrend(12, 10)).toEqual({ current: 12, previous: 10, delta: 2, percentage: 20, direction: "up" });
    expect(calculateTrend(0, 0).direction).toBe("flat");
    expect(calculateTrend(5, 10).direction).toBe("down");
  });

  it("agrega falhas diárias e compara as duas últimas janelas", () => {
    const now = new Date("2026-10-16T12:00:00.000Z");
    const runs = [
      { status: "failed", startedAt: new Date("2026-10-03T10:00:00.000Z"), httpStatus: 403, details: "Cloudflare WAF" },
      { status: "succeeded", startedAt: new Date("2026-10-10T10:00:00.000Z"), httpStatus: 200 },
      { status: "failed", startedAt: new Date("2026-10-15T10:00:00.000Z"), details: "Invalid user id (code 110)" },
    ];
    const series = buildDailyTelemetrySeries(runs, now, 14);
    expect(series).toHaveLength(14);
    expect(series.at(-7)?.succeeded).toBe(1);
    expect(series.at(-2)?.meta110).toBe(1);
    expect(summarizeTelemetryTrend(series).meta110.current).toBe(1);
  });
});
