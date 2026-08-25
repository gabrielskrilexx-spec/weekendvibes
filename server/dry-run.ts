import { runIngestionPipeline, sanitizeFetchFailure, type IngestionSourceReport } from "./ingestion";
import { runInstagramPipeline } from "./instagram-pipeline";

export type DryRunSourceReport = IngestionSourceReport & { routine: "public-agenda" | "instagram-agenda" };

export type DryRunReport = {
  dryRun: true;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sources: DryRunSourceReport[];
  totals: {
    read: number;
    filtered: number;
    persistable: number;
    duplicates: number;
    errors: number;
  };
};

const emptyRejectionReasons = () => ({ fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 });

function normalizePublicSourceReports(result: unknown): DryRunSourceReport[] {
  if (!result || typeof result !== "object") return [];
  const value = result as { sourceReports?: unknown[] };
  if (!Array.isArray(value.sourceReports)) return [];
  return value.sourceReports.filter(item => item && typeof item === "object").map(item => {
    const report = item as Partial<IngestionSourceReport>;
    return {
      routine: "public-agenda" as const,
      sourceKey: String(report.sourceKey ?? "public:unknown").slice(0, 160),
      durationMs: Math.max(0, Number(report.durationMs ?? (result && typeof result === "object" && "durationMs" in result ? (result as { durationMs?: unknown }).durationMs : 0) ?? 0)),
      medianDurationMs: Math.max(0, Number(report.medianDurationMs ?? report.durationMs ?? 0)),
      p95DurationMs: Math.max(0, Number(report.p95DurationMs ?? report.durationMs ?? 0)),
      read: Math.max(0, Number(report.read ?? 0)),
      filtered: Math.max(0, Number(report.filtered ?? 0)),
      persistable: Math.max(0, Number(report.persistable ?? 0)),
      duplicates: Math.max(0, Number(report.duplicates ?? 0)),
      errors: Array.isArray(report.errors) ? report.errors.slice(0, 20).map(error => ({
        sourceUrl: typeof error?.sourceUrl === "string" ? error.sourceUrl.slice(0, 300) : undefined,
        status: typeof error?.status === "number" ? error.status : null,
        message: String(error?.message ?? "Falha sanitizada na fonte").slice(0, 240),
      })) : [],
      rejectionReasons: { ...emptyRejectionReasons(), ...(report.rejectionReasons ?? {}) },
    };
  });
}

function normalizeInstagramSourceReports(result: unknown): DryRunSourceReport[] {
  if (!result || typeof result !== "object") return [];
  const value = result as { sourceReports?: unknown[]; durationMs?: unknown; receivedPosts?: unknown; filtered?: unknown; imported?: unknown; duplicates?: unknown; transportFailures?: unknown[]; rejectionReasons?: Record<string, unknown> };
  const provided = Array.isArray(value.sourceReports) ? value.sourceReports[0] as Partial<IngestionSourceReport> | undefined : undefined;
  const errors = Array.isArray(value.transportFailures) ? value.transportFailures.slice(0, 20).map(rawFailure => {
    const failure = rawFailure && typeof rawFailure === "object" ? rawFailure as { username?: unknown; status?: unknown; message?: unknown } : {};
    return {
      sourceUrl: typeof failure.username === "string" ? `@${failure.username}` : undefined,
      status: typeof failure.status === "number" ? failure.status : null,
      message: String(failure.message ?? "Falha sanitizada no Instagram").slice(0, 240),
    };
  }) : [];
  return [{
    routine: "instagram-agenda",
    sourceKey: "instagram",
    durationMs: Math.max(0, Number(provided?.durationMs ?? value.durationMs ?? 0)),
    medianDurationMs: Math.max(0, Number(provided?.medianDurationMs ?? provided?.durationMs ?? value.durationMs ?? 0)),
    p95DurationMs: Math.max(0, Number(provided?.p95DurationMs ?? provided?.durationMs ?? value.durationMs ?? 0)),
    read: Math.max(0, Number(provided?.read ?? value.receivedPosts ?? 0)),
    filtered: Math.max(0, Number(provided?.filtered ?? value.filtered ?? 0)),
    persistable: Math.max(0, Number(provided?.persistable ?? value.imported ?? 0)),
    duplicates: Math.max(0, Number(provided?.duplicates ?? value.duplicates ?? 0)),
    errors: provided?.errors?.length ? provided.errors : errors,
    rejectionReasons: {
      ...emptyRejectionReasons(),
      ...(provided?.rejectionReasons ?? {}),
      outsideTargetVenue: Number(value.rejectionReasons?.outside_target_venue ?? provided?.rejectionReasons?.outsideTargetVenue ?? 0),
      invalidStructuredEvent: Number(provided?.rejectionReasons?.invalidStructuredEvent ?? 0),
      pastEvent: Number(value.rejectionReasons?.past_event ?? provided?.rejectionReasons?.pastEvent ?? 0),
    },
  }];
}

function normalizeFailureSource(routine: DryRunSourceReport["routine"], error: unknown): DryRunSourceReport {
  const failure = sanitizeFetchFailure(error);
  return {
    routine,
    sourceKey: routine === "instagram-agenda" ? "instagram" : "public:unknown",
    durationMs: 0,
    medianDurationMs: 0,
    p95DurationMs: 0,
    read: 0,
    filtered: 0,
    persistable: 0,
    duplicates: 0,
    errors: [{ status: failure.status, message: failure.message }],
    rejectionReasons: { ...emptyRejectionReasons(), fetchFailed: 1 },
  };
}

export async function runDryRun(): Promise<DryRunReport> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const [publicResult, instagramResult] = await Promise.allSettled([
    runIngestionPipeline({ dryRun: true }),
    runInstagramPipeline({ dryRun: true }),
  ]);
  const sources = [
    ...(publicResult.status === "fulfilled" ? normalizePublicSourceReports(publicResult.value) : [normalizeFailureSource("public-agenda", publicResult.reason)]),
    ...(instagramResult.status === "fulfilled" ? normalizeInstagramSourceReports(instagramResult.value) : [normalizeFailureSource("instagram-agenda", instagramResult.reason)]),
  ];
  const finished = Date.now();
  return {
    dryRun: true,
    startedAt,
    finishedAt: new Date(finished).toISOString(),
    durationMs: Math.max(0, finished - started),
    sources,
    totals: sources.reduce((totals, source) => ({
      read: totals.read + source.read,
      filtered: totals.filtered + source.filtered,
      persistable: totals.persistable + source.persistable,
      duplicates: totals.duplicates + source.duplicates,
      errors: totals.errors + source.errors.length,
    }), { read: 0, filtered: 0, persistable: 0, duplicates: 0, errors: 0 }),
  };
}

export function normalizeDryRunReportForTest(report: DryRunReport) {
  return {
    dryRun: report.dryRun,
    sourceKeys: report.sources.map(source => source.sourceKey),
    totals: report.totals,
    hasNoPersistenceIds: report.sources.every(source => source.persistable >= 0),
  };
}
