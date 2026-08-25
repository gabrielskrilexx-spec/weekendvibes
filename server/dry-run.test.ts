import { describe, expect, it, vi } from "vitest";
import { normalizeDryRunReportForTest, runDryRun } from "./dry-run";

const mocks = vi.hoisted(() => ({
  runIngestionPipeline: vi.fn().mockResolvedValue({
    sourceReports: [{ sourceKey: "public:blackpass", durationMs: 240, read: 4, filtered: 3, persistable: 1, duplicates: 0, errors: [], rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 3, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
  }),
  runInstagramPipeline: vi.fn().mockResolvedValue({
    dryRun: true,
    sourceReports: [{ sourceKey: "instagram", durationMs: 780, read: 6, filtered: 4, persistable: 2, duplicates: 0, errors: [], rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 1, invalidStructuredEvent: 2, duplicate: 0, pastEvent: 1 } }],
  }),
}));

vi.mock("./ingestion", () => ({ runIngestionPipeline: mocks.runIngestionPipeline, sanitizeFetchFailure: (error: unknown) => ({ status: null, message: error instanceof Error ? error.message : "falha" }) }));
vi.mock("./instagram-pipeline", () => ({ runInstagramPipeline: mocks.runInstagramPipeline }));

describe("dry-run orchestration", () => {
  it("runs both pipelines in simulation mode and aggregates source metrics", async () => {
    const result = await runDryRun();

    expect(mocks.runIngestionPipeline).toHaveBeenCalledWith({ dryRun: true });
    expect(mocks.runInstagramPipeline).toHaveBeenCalledWith({ dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.sources.map(source => source.sourceKey)).toEqual(["public:blackpass", "instagram"]);
    expect(result.totals).toMatchObject({ read: 10, filtered: 7, persistable: 3, errors: 0 });
    expect(result.sources.map(source => source.durationMs)).toEqual([240, 780]);
    expect(normalizeDryRunReportForTest(result)).toMatchObject({ dryRun: true, hasNoPersistenceIds: true });
  });
});
