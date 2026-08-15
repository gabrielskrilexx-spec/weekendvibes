import { describe, expect, it } from "vitest";
import { buildWeeklyTrendForTest, isCriticalIngestionFailure, isZeroMediaMetaRunForTest } from "./ingestion-reports";

describe("ingestion report critical failures", () => {
  it("classifies timeout failures", () => {
    expect(isCriticalIngestionFailure({ error: "activity timeout" })).toBe(true);
  });

  it("classifies HTTP 5xx failures", () => {
    expect(isCriticalIngestionFailure({ status: 503, message: "upstream unavailable" })).toBe(true);
    expect(isCriticalIngestionFailure("non-2xx response: 500")).toBe(true);
  });

  it("does not classify ordinary ingestion failures as critical", () => {
    expect(isCriticalIngestionFailure({ message: "source returned no matching events" })).toBe(false);
    expect(isCriticalIngestionFailure(null)).toBe(false);
  });
});


describe("weekly ingestion trend and Meta zero-media signal", () => {
  it("classifies a successful Instagram run with zero received posts as a Meta permission signal", () => {
    expect(isZeroMediaMetaRunForTest({ routine: "instagram-agenda", sourceKey: "instagram" }, { receivedPosts: 0 })).toBe(true);
    expect(isZeroMediaMetaRunForTest({ routine: "instagram-agenda", sourceKey: "instagram" }, { receivedPosts: 2 })).toBe(false);
    expect(isZeroMediaMetaRunForTest({ routine: "public-agenda", sourceKey: "public" }, { receivedPosts: 0 })).toBe(false);
  });

  it("aggregates seven daily buckets and ingestion counters for the admin trend", () => {
    const now = new Date();
    const trend = buildWeeklyTrendForTest([
      { routine: "instagram-agenda", sourceKey: "instagram", status: "succeeded", importedCount: 2, startedAt: now, details: { receivedPosts: 4, approvedPosts: 2, structuredEvents: 2 } },
      { routine: "instagram-agenda", sourceKey: "instagram", status: "failed", importedCount: 0, startedAt: now, details: { receivedPosts: 0 } },
    ]);
    expect(trend).toHaveLength(7);
    const today = trend.at(-1)!;
    expect(today.runs).toBe(2);
    expect(today.succeeded).toBe(1);
    expect(today.failed).toBe(1);
    expect(today.receivedPosts).toBe(4);
    expect(today.approvedPosts).toBe(2);
    expect(today.structuredEvents).toBe(2);
    expect(today.imported).toBe(2);
    expect(today.zeroMediaRuns).toBe(1);
  });
});
