import { describe, expect, it } from "vitest";
import { buildMetaIntegrationStatusForTest, buildFreshnessForTest, buildSourceReconciliationForTest, findConsecutiveFailureAlertsForTest, buildWeeklyTrendForTest, buildDailyIngestionMetricsForTest, getPastEventRejectionQualityForTest, createSanitizedReprocessErrorForTest, getFreshnessState, isCriticalIngestionFailure, normalizeManualReprocessResultForTest, isZeroMediaMetaRunForTest, normalizeIngestionCountsForTest, normalizeReportForTransport, sanitizeReprocessErrorForTest, serializeIngestionRunForTest, serializeOperationalAlertForTest, buildFilteredStoriesCsv, sortFilteredStoriesForTest, DEFAULT_PUBLIC_P95_THRESHOLD_MS, getEffectiveSourceP95ThresholdForTest, findConsecutiveP95PerformanceAlertsForTest } from "./ingestion-reports";
import { InstagramIntegrationFailure } from "./instagram-pipeline";
import { sanitizeAgendaStepErrorForTest } from "./agenda-routine";

describe("filtered stories ordering", () => {
  const story = (id: string, username: string, status: "pending" | "approved", postedAt: string) => ({ id, runId: 1, username, mediaOrigin: "story" as const, imageUrl: "", sourceUrl: "", postedAt, expiresAt: null, ocrText: "", rawText: "", reasons: [], status, approvedBy: null, approvedAt: null });
  it("ordena por data, fonte e status em ambas as direções", () => {
    const stories = [story("a", "zeta", "pending", "2026-08-28T00:00:00.000Z"), story("b", "alpha", "approved", "2026-08-29T00:00:00.000Z")];
    expect(sortFilteredStoriesForTest(stories, "date", "desc").map(item => item.id)).toEqual(["b", "a"]);
    expect(sortFilteredStoriesForTest(stories, "source", "asc").map(item => item.id)).toEqual(["b", "a"]);
    expect(sortFilteredStoriesForTest(stories, "status", "asc").map(item => item.id)).toEqual(["b", "a"]);
  });
});

describe("filtered stories CSV", () => {
  it("gera CSV com BOM, cabeçalho e escape RFC 4180", () => {
    const csv = buildFilteredStoriesCsv([{ id: "story-1", runId: 7, username: "meulugar.bar", mediaOrigin: "story", imageUrl: "https://example.com/flyer.png", sourceUrl: "https://instagram.com/meulugar.bar", postedAt: "2026-08-29T01:00:00.000Z", expiresAt: null, ocrText: 'Evento, "especial"', rawText: "Texto bruto", reasons: ["sem data", "baixa confiança"], status: "approved", approvedBy: "admin-open-id", approvedAt: "2026-08-29T02:00:00.000Z" }]);
    expect(csv.startsWith("\uFEFF\"id\",\"run_id\"" )).toBe(true);
    expect(csv).toContain('"Evento, ""especial"""');
    expect(csv).toContain('"sem data | baixa confiança"');
    expect(csv.endsWith("\n")).toBe(true);
  });

  it("retorna somente cabeçalho quando não há resultados", () => {
    expect(buildFilteredStoriesCsv([])).toBe("\uFEFF\"id\",\"run_id\",\"username\",\"media_origin\",\"image_url\",\"source_url\",\"posted_at\",\"expires_at\",\"ocr_text\",\"raw_text\",\"reasons\",\"status\",\"approved_by\",\"approved_at\"\n");
  });
});

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
    expect(normalized).toEqual({ ok: true, sourceKey: "instagram", routine: "instagram-agenda", imported: 2, counts: { read: 4, filtered: 2, persisted: 2, duplicates: 1 }, degraded: true, accepted: false });
    expect(() => JSON.stringify(normalized)).not.toThrow();
  });

  it("marks an Instagram reprocess ACK as accepted without inventing final counters", () => {
    expect(normalizeManualReprocessResultForTest({ ok: true, sourceKey: "instagram", routine: "instagram-agenda", accepted: true, counts: { read: 0, filtered: 0, persisted: 0, duplicates: 0 } })).toMatchObject({ ok: true, routine: "instagram-agenda", accepted: true, counts: { read: 0, filtered: 0, persisted: 0, duplicates: 0 } });
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

describe("public ingestion P95 SLA", () => {
  it("uses a 15 second default for public sources while preserving the Instagram default", () => {
    expect(DEFAULT_PUBLIC_P95_THRESHOLD_MS).toBe(15_000);
    expect(getEffectiveSourceP95ThresholdForTest({ kind: "public", p95LatencyThresholdMs: 3_000 })).toBe(15_000);
    expect(getEffectiveSourceP95ThresholdForTest({ kind: "instagram", p95LatencyThresholdMs: 3_000 })).toBe(3_000);
  });

  it("does not alert public sources below the 15 second threshold", () => {
    const runs = [
      { sourceKey: "public:articket", status: "succeeded", startedAt: "2026-08-22T10:00:00.000Z", durationMs: 10_500 },
      { sourceKey: "public:articket", status: "succeeded", startedAt: "2026-08-22T09:00:00.000Z", durationMs: 10_200 },
    ];

    expect(findConsecutiveP95PerformanceAlertsForTest(runs, new Map([["public:articket", getEffectiveSourceP95ThresholdForTest({ kind: "public", p95LatencyThresholdMs: 3_000 })]]))).toEqual([]);
  });

  it("still alerts public sources when two consecutive runs exceed 15 seconds", () => {
    const threshold = getEffectiveSourceP95ThresholdForTest({ kind: "public", p95LatencyThresholdMs: 3_000 });
    const alerts = findConsecutiveP95PerformanceAlertsForTest([
      { sourceKey: "public:articket", status: "succeeded", startedAt: "2026-08-22T10:00:00.000Z", durationMs: 16_000 },
      { sourceKey: "public:articket", status: "succeeded", startedAt: "2026-08-22T09:00:00.000Z", durationMs: 17_000 },
    ], new Map([["public:articket", threshold]]));

    expect(alerts[0]).toMatchObject({ sourceKey: "public:articket", thresholdMs: 15_000, consecutiveRuns: 2 });
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
    expect(today.persisted).toBe(2);
    expect(today.rejectedPastEvents).toBe(0);
    expect(today.zeroMediaRuns).toBe(1);
  });

  it("aggregates allowlist rejections into the daily monitoring metric", () => {
    const now = new Date();
    const trend = buildDailyIngestionMetricsForTest([
      { routine: "public-agenda", sourceKey: "public", status: "succeeded", importedCount: 1, startedAt: now, details: { read: 5, persisted: 1, filteredByReason: { outsideTargetVenue: 3 } } },
    ], now);
    expect(trend).toHaveLength(7);
    expect(trend.at(-1)).toMatchObject({ runs: 1, receivedPosts: 5, persisted: 1, rejectedAllowlist: 3 });
  });

  it("separates the 50% quality threshold from ordinary cycles", () => {
    expect(getPastEventRejectionQualityForTest({ read: 10, rejectedPastEvents: 5 })).toMatchObject({ percentage: 0.5, exceedsThreshold: false });
    expect(getPastEventRejectionQualityForTest({ read: 10, rejectedPastEvents: 6 })).toMatchObject({ percentage: 0.6, exceedsThreshold: true });
    expect(getPastEventRejectionQualityForTest({ read: 0, rejectedPastEvents: 4 })).toMatchObject({ percentage: 0, exceedsThreshold: false });
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

describe("consecutive failure observability", () => {
  it("flags two consecutive exhausted scheduled failures per routine", () => {
    const base = new Date("2026-08-22T10:00:00.000Z");
    expect(findConsecutiveFailureAlertsForTest([
      { id: 10, routine: "public-agenda", sourceKey: "public", status: "failed", startedAt: base, details: { retries: 2, retryExhausted: true } },
      { id: 9, routine: "public-agenda", sourceKey: "public", status: "failed", startedAt: new Date(base.getTime() - 3600000), details: { retries: 2, retryExhausted: true } },
      { id: 8, routine: "public-agenda", sourceKey: "public", status: "succeeded", startedAt: new Date(base.getTime() - 7200000), details: { retries: 0 } },
    ])).toEqual([{ routine: "public-agenda", count: 2, runIds: [10, 9], latestStartedAt: base.toISOString() }]);
  });

  it("does not alert for a single failure or a non-exhausted retry", () => {
    expect(findConsecutiveFailureAlertsForTest([
      { id: 2, routine: "instagram-agenda", sourceKey: "instagram", status: "failed", startedAt: new Date("2026-08-22T10:00:00.000Z"), details: { retries: 1 } },
      { id: 1, routine: "instagram-agenda", sourceKey: "instagram", status: "succeeded", startedAt: new Date("2026-08-22T09:00:00.000Z"), details: {} },
    ])).toEqual([]);
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
