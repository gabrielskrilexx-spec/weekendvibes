import { describe, expect, it } from "vitest";
import { buildSourceTelemetryForTest } from "./ingestion-reports";

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
});
