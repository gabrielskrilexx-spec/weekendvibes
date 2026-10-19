import { describe, expect, it } from "vitest";
import { listIngestionReport } from "./ingestion-reports";

describe("ingestion report PostgreSQL compatibility", () => {
  it("loads admin totals without boolean SUM or camelCase SQL failures", async () => {
    const report = await listIngestionReport(5, { periodDays: 7 });

    expect(report.totals).toEqual(
      expect.objectContaining({
        succeeded: expect.any(Number),
        failed: expect.any(Number),
        partial: expect.any(Number),
        imported: expect.any(Number),
      }),
    );
  });
});
