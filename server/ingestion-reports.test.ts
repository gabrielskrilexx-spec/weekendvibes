import { describe, expect, it } from "vitest";
import { buildMetaIntegrationStatusForTest, buildWeeklyTrendForTest, isCriticalIngestionFailure, isZeroMediaMetaRunForTest, normalizeIngestionCountsForTest } from "./ingestion-reports";

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

describe("persisted ingestion observability", () => {
  it("normalizes a degraded Meta run to explicit zero counters", () => {
    expect(normalizeIngestionCountsForTest({ details: { degraded: true, upstreamStatus: 503 }, counts: { read: 0, filtered: 0, persisted: 0 } })).toMatchObject({ read: 0, filtered: 0, persisted: 0, approved: 0, structured: 0 });
  });

  it("derives filtered and persisted counters from a successful pipeline result", () => {
    expect(normalizeIngestionCountsForTest({ details: { archived: 0, result: { receivedPosts: 7, approvedPosts: 3, structuredEvents: 2, imported: 2 } } })).toMatchObject({ read: 7, filtered: 4, persisted: 2, approved: 3, structured: 2 });
  });
});

describe("Meta integration status", () => {
  const base = new Date("2026-08-18T10:00:00.000Z");

  it("reports the latest status and last successful synchronization", () => {
    expect(buildMetaIntegrationStatusForTest([
      { status: "succeeded", startedAt: base, finishedAt: new Date("2026-08-18T10:05:00.000Z") },
      { status: "failed", startedAt: new Date("2026-08-18T11:00:00.000Z"), finishedAt: new Date("2026-08-18T11:01:00.000Z") },
    ])).toEqual({ status: "failed", lastSuccessfulSync: "2026-08-18T10:05:00.000Z", lastAttempt: "2026-08-18T11:00:00.000Z" });
  });

  it("distinguishes degraded and never-synchronized states", () => {
    expect(buildMetaIntegrationStatusForTest([{ status: "partial", startedAt: base }]).status).toBe("degraded");
    expect(buildMetaIntegrationStatusForTest([])).toEqual({ status: "never", lastSuccessfulSync: null, lastAttempt: null });
  });
});
