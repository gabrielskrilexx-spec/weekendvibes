import { describe, expect, it } from "vitest";
import { buildMetaIntegrationStatusForTest, buildFreshnessForTest, buildSourceReconciliationForTest, buildWeeklyTrendForTest, createSanitizedReprocessErrorForTest, getFreshnessState, isCriticalIngestionFailure, normalizeManualReprocessResultForTest, isZeroMediaMetaRunForTest, normalizeIngestionCountsForTest, normalizeReportForTransport, sanitizeReprocessErrorForTest, serializeIngestionRunForTest, serializeOperationalAlertForTest } from "./ingestion-reports";
import { InstagramIntegrationFailure } from "./instagram-pipeline";
import { sanitizeAgendaStepErrorForTest } from "./agenda-routine";

describe("manual reprocess error transport", () => {
  it("sanitizes integration failures before tRPC transport", () => {
    const error = new InstagramIntegrationFailure("meta", "Meta Graph API request failed with HTTP 400", { cause: { accessToken: "secret" } });
    expect(sanitizeReprocessErrorForTest(error)).toBe("Falha na integração meta (HTTP 400)");
    expect(sanitizeReprocessErrorForTest(error)).not.toContain("secret");
  });

  it("keeps ordinary errors bounded", () => {
    expect(sanitizeReprocessErrorForTest(new Error("x".repeat(500)))).toHaveLength(240);
  });

  it("sanitizes the upstream agenda error before it is rethrown", () => {
    const error = new InstagramIntegrationFailure("meta", "upstream body with accessToken=secret", { cause: { accessToken: "secret" } });
    expect(sanitizeAgendaStepErrorForTest(error, "instagram", 400)).toBe("Falha na integração Meta (HTTP 400)");
    expect(sanitizeAgendaStepErrorForTest(error, "instagram", 503)).toBe("Falha na integração Meta (HTTP 503)");
    expect(sanitizeAgendaStepErrorForTest(error, "instagram", null, true)).toBe("Execução degradada da integração Meta");
    expect(sanitizeAgendaStepErrorForTest(error, "instagram")).not.toContain("secret");
  });

  it("normalizes report rows into JSON-safe primitives", () => {
    const run = serializeIngestionRunForTest({ id: 7, routine: "manual-reprocess", sourceKey: "instagram", status: "succeeded", importedCount: 2, failedCount: 0, durationMs: 100, httpStatus: 200, counts: '{"read":2}', details: '{"imported":2}', startedAt: new Date("2026-08-19T10:00:00.000Z"), finishedAt: new Date("2026-08-19T10:00:01.000Z") });
    const alert = serializeOperationalAlertForTest({ id: 3, integration: "meta", severity: "WARNING", alertType: "freshness", slaMinutes: 60, runId: "7", title: "Atenção", message: "Sem dados", isResolved: 0, createdAt: new Date("2026-08-19T10:00:00.000Z") });
    expect(() => JSON.stringify({ run, alert })).not.toThrow();
    expect(run.startedAt).toBe("2026-08-19T10:00:00.000Z");
    expect(alert.createdAt).toBe("2026-08-19T10:00:00.000Z");
  });

  it("normalizes nested report values before the tRPC transformer", () => {
    const normalized = normalizeReportForTransport({ count: BigInt(3), error: new Error("internal"), nested: { value: 4 } });
    expect(normalized).toEqual({ count: 3, error: { name: "Error", message: "internal" }, nested: { value: 4 } });
    expect(() => JSON.stringify(normalized)).not.toThrow();
  });

  it("normalizes the manual Instagram result to JSON-safe primitives", () => {
    const normalized = normalizeManualReprocessResultForTest({ ok: true, sourceKey: "instagram", routine: "instagram-agenda", imported: BigInt(2), counts: { read: BigInt(4), filtered: 2, persisted: 2, duplicates: 1 }, degraded: true, unsafe: new Error("hidden") });
    expect(normalized).toEqual({ ok: true, sourceKey: "instagram", routine: "instagram-agenda", imported: 2, counts: { read: 4, filtered: 2, persisted: 2, duplicates: 1 }, degraded: true });
    expect(() => JSON.stringify(normalized)).not.toThrow();
  });

  it("builds a transport-safe tRPC error without the upstream cause", () => {
    const error = new InstagramIntegrationFailure("meta", "Meta failure", { cause: { accessToken: "secret" } });
    const transportError = createSanitizedReprocessErrorForTest(error);
    expect(transportError.code).toBe("INTERNAL_SERVER_ERROR");
    expect(transportError.message).toBe("Falha na integração meta");
    expect(transportError.cause).toBeUndefined();
    expect(JSON.stringify(transportError)).not.toContain("secret");
  });
});

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


describe("freshness and source reconciliation", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("classifies freshness against the configured frequency", () => {
    expect(getFreshnessState(new Date(now.getTime() - 30 * 60000), 60, now)).toBe("healthy");
    expect(getFreshnessState(new Date(now.getTime() - 100 * 60000), 60, now)).toBe("delayed");
    expect(getFreshnessState(new Date(now.getTime() - 200 * 60000), 60, now)).toBe("critical");
    expect(getFreshnessState(null, 60, now)).toBe("never");
  });

  it("aggregates read, filtered, persisted and duplicates per source", () => {
    expect(buildSourceReconciliationForTest([
      { sourceKey: "instagram", importedCount: 2, details: { read: 7, filtered: 3, persisted: 2, duplicates: 1, missingCoordinates: 1 } },
      { sourceKey: "instagram", importedCount: 1, details: { read: 4, filtered: 2, persisted: 1, duplicates: 2, outOfBoundsCoordinates: 1 } },
    ])).toEqual([{ sourceKey: "instagram", read: 11, filtered: 5, persisted: 3, duplicates: 3, invalidCoordinates: 1, outOfBoundsCoordinates: 1, runs: 2 }]);
  });

  it("builds a source freshness view with explicit states", () => {
    expect(buildFreshnessForTest([{ sourceKey: "instagram", lastSuccessAt: new Date(now.getTime() - 500 * 60000), expectedMinutes: 60 }], now)[0].state).toBe("critical");
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
