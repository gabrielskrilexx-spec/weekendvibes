import { describe, expect, it } from "vitest";
import { buildSourceTelemetryForTest, buildSourceTelemetryHistoryForTest, findConsecutiveP95PerformanceAlertsForTest } from "./ingestion-reports";

describe("telemetria por fonte", () => {
  it("agrega sucesso, latência e categorias de bloqueio", () => {
    const result = buildSourceTelemetryForTest([
      { sourceKey: "blacktag", status: "failed", httpStatus: 403, durationMs: 120, details: { message: "Cloudflare challenge" } },
      { sourceKey: "blacktag", status: "failed", httpStatus: 502, durationMs: 240, details: { message: "Bad gateway" } },
      { sourceKey: "blacktag", status: "succeeded", httpStatus: 200, durationMs: 300, details: {} },
      { sourceKey: "instagram", status: "failed", httpStatus: 0, durationMs: 80, details: { message: "SANDBOX_RESTRICTED" } },
    ]);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey: "blacktag", runs: 3, successes: 1, successRate: 0.3333, averageLatencyMs: 220, errors: expect.arrayContaining([{ category: "anti_bot", count: 1 }, { category: "proxy", count: 1 }]) }),
      expect.objectContaining({ sourceKey: "instagram", errors: [{ category: "sandbox", count: 1 }] }),
    ]));
  });

  it("detecta P95 elevado somente após duas rodadas consecutivas", () => {
    const singleSlow = findConsecutiveP95PerformanceAlertsForTest([{ sourceKey: "mringressos", status: "succeeded", startedAt: "2026-08-26T12:00:00.000Z", durationMs: 4200 }]);
    expect(singleSlow).toEqual([]);
    const consecutiveSlow = findConsecutiveP95PerformanceAlertsForTest([
      { sourceKey: "mringressos", status: "succeeded", startedAt: "2026-08-26T13:00:00.000Z", durationMs: 4200 },
      { sourceKey: "mringressos", status: "succeeded", startedAt: "2026-08-26T12:00:00.000Z", durationMs: 3800 },
    ]);
    expect(consecutiveSlow).toEqual([expect.objectContaining({ sourceKey: "mringressos", p95LatencyMs: 4200, thresholdMs: 3000, consecutiveRuns: 2 })]);
  });

  it("agrupa o histórico por dia e fonte com latência média e taxa de sucesso", () => {
    const result = buildSourceTelemetryHistoryForTest([
      { sourceKey: "blackpass", status: "succeeded", startedAt: "2026-08-25T12:00:00.000Z", durationMs: 100 },
      { sourceKey: "blackpass", status: "failed", startedAt: "2026-08-25T13:00:00.000Z", durationMs: 300 },
    ]);
    expect(result).toEqual([expect.objectContaining({ sourceKey: "blackpass", runs: 2, successes: 1, successRate: 0.5, averageLatencyMs: 200 })]);
  });
});
