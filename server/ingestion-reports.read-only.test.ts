import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listIngestionReport, runReportStage } from "./ingestion-reports";
import { getDatabaseErrorDiagnostic } from "./db";

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

  it("isola uma etapa auxiliar com fallback e código sanitizado", async () => {
    const result = await runReportStage("operational-alerts", [], async () => {
      throw Object.assign(new Error("connection details should not reach the client"), { code: "57014" });
    });
    expect(result.value).toEqual([]);
    expect(result.diagnostic).toBe("stage:operational-alerts");
  });

  it("normaliza códigos PostgreSQL sem expor mensagem, URL ou stack", () => {
    expect(getDatabaseErrorDiagnostic(Object.assign(new Error("password=secret host=db.internal"), { code: "42703" }))).toBe("PG:42703");
    expect(getDatabaseErrorDiagnostic(Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }))).toBe("PG:57014");
    expect(getDatabaseErrorDiagnostic(new Error("connect ECONNRESET"))).toBe("ERR:connection");
  });
});
