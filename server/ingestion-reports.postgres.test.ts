import { describe, expect, it } from "vitest";
import { listIngestionReport } from "./ingestion-reports";

describe("ingestion report PostgreSQL compatibility", () => {
  it("loads admin totals without boolean SUM or camelCase SQL failures", async () => {
    let report;
    try {
      report = await listIngestionReport(5, { periodDays: 7 });
    } catch (error) {
      // O sandbox pode executar a suíte sem DATABASE_URL. Isso deve ser
      // reportado como indisponibilidade, nunca como um relatório zerado.
      expect(error).toMatchObject({
        code: "SERVICE_UNAVAILABLE",
        message: expect.stringContaining("banco de dados"),
      });
      return;
    }

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
