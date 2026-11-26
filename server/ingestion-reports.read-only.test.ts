import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listIngestionReport } from "./ingestion-reports";

const reportSource = readFileSync(new URL("./ingestion-reports.ts", import.meta.url), "utf8");
const reportStart = reportSource.indexOf("export async function listIngestionReport");
const nextExport = reportSource.indexOf("\nexport ", reportStart + 1);
const reportFunction = reportStart >= 0
  ? reportSource.slice(reportStart, nextExport >= 0 ? nextExport : reportSource.length)
  : "";

describe("listIngestionReport — contrato somente leitura", () => {
  it("não importa nem dispara alertas, webhooks ou escritas durante a leitura", () => {
    expect(reportFunction).toContain("export async function listIngestionReport");
    expect(reportFunction).not.toMatch(/handleIngestionFailureAlert|notifyPerformanceDegradationWebhook|notifyConsecutiveFailureWebhook/);
    expect(reportFunction).not.toMatch(/\.update\(|\.insert\(|\.delete\(|recordOperationalAlert\(/);
  });

  it("não transforma banco indisponível em relatório vazio", async () => {
    await expect(listIngestionReport(5, { periodDays: 7 })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: expect.stringContaining("banco de dados"),
    });
  });
});
