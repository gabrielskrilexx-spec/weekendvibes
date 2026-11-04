import { describe, expect, it } from "vitest";
import { buildIngestionSourceReportSummaries } from "./ingestion-source-report";

describe("ingestion source report summaries", () => {
  it("creates a successful summary that replaces a stale failure message", () => {
    expect(buildIngestionSourceReportSummaries({ sourceReports: [{
      sourceKey: "public:articket",
      read: 81,
      added: 0,
      updated: 6,
      ignored: 74,
      errors: [],
    }] })).toEqual([{
      sourceKey: "public:articket",
      message: "Coleta concluída: 81 lidos, 0 novos, 6 atualizados, 74 ignorados; 0 erro(s).",
    }]);
  });

  it("marks partial reports and counts failures without copying upstream error details", () => {
    const summaries = buildIngestionSourceReportSummaries({
      publicSources: { result: { sourceReports: [{
        sourceKey: "public:weticket",
        read: 2,
        added: 0,
        updated: 0,
        ignored: 0,
        errors: [{ status: 403, message: "private upstream response" }],
      }] } },
    });
    expect(summaries).toEqual([{
      sourceKey: "public:weticket",
      message: "Coleta parcial: 2 lidos, 0 novos, 0 atualizados, 0 ignorados; 1 erro(s).",
    }]);
    expect(JSON.stringify(summaries)).not.toContain("private upstream response");
  });

  it("ignores malformed reports and normalizes non-finite counters", () => {
    expect(buildIngestionSourceReportSummaries({ sourceReports: [null, { sourceKey: "", errors: [] }, { sourceKey: "public:ingresse", read: "NaN", added: -1, updated: 2.7, filtered: 3, errors: [] }] })).toEqual([{
      sourceKey: "public:ingresse",
      message: "Coleta concluída: 0 lidos, 0 novos, 2 atualizados, 3 ignorados; 0 erro(s).",
    }]);
  });

  it("collects reports from both branches of a composite run", () => {
    const summaries = buildIngestionSourceReportSummaries({
      publicSources: { sourceReports: [{ sourceKey: "public:articket", read: 1, updated: 1, errors: [] }] },
      instagram: { result: { sourceReports: [{ sourceKey: "instagram", read: 2, added: 1, errors: [] }] } },
    });
    expect(summaries.map(summary => summary.sourceKey)).toEqual(["public:articket", "instagram"]);
  });
});
