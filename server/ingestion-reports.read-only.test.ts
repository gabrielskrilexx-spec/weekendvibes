import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listIngestionReport, runReportStage, toSafeIsoDate } from "./ingestion-reports";
import { getDatabaseErrorDiagnostic, getDatabaseErrorLogContext, toPostgresDateParameter } from "./db";
import { readFileSync as readSqlFile } from "node:fs";
import { OPERATIONAL_SCHEMA_COLUMNS } from "./db";

const reportSource = readFileSync(new URL("./ingestion-reports.ts", import.meta.url), "utf8");
const reportStart = reportSource.indexOf("export async function listIngestionReport");
const nextExport = reportSource.indexOf("\nexport ", reportStart + 1);
const reportFunction = reportStart >= 0
  ? reportSource.slice(reportStart, nextExport >= 0 ? nextExport : reportSource.length)
  : "";

describe("listIngestionReport — contrato somente leitura", () => {
  it("não importa nem dispara alertas, webhooks ou escritas durante a leitura", () => {
    expect(reportFunction).toContain("export async function listIngestionReport");
    expect(reportFunction).not.toContain("ensureOperationalSchemaCompatibility");
    expect(reportFunction).not.toMatch(/CREATE TABLE|ALTER TABLE|\.execute\(/i);
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
    expect(getDatabaseErrorDiagnostic(Object.assign(new Error("password=secret host=db.internal"), { code: "42703" }))).toBe("PG:42703:column_missing");
    expect(getDatabaseErrorDiagnostic(Object.assign(new Error("wrapper"), { cause: Object.assign(new Error("canceling statement"), { code: "57014" }) }))).toBe("PG:57014:query_canceled");
    expect(getDatabaseErrorDiagnostic(Object.assign(new Error("outer"), { cause: Object.assign(new Error("relation missing"), { cause: Object.assign(new Error("missing relation"), { code: "42P01" }) }) }))).toBe("PG:42P01:relation_missing");
    expect(getDatabaseErrorDiagnostic(new Error("connect ECONNRESET"))).toBe("ERR:connection");
    expect(getDatabaseErrorDiagnostic(new Error("invalid date parameter"))).toBe("ERR:QUERY:invalid_date_param");
  });

  it("registra nome, código e causa sem expor credenciais ou URLs", () => {
    const error = Object.assign(new Error("wrapper"), {
      code: "DRIZZLE_WRAPPER",
      cause: Object.assign(new Error("password=secret https://db.internal/query"), { code: "42703" }),
    });
    expect(getDatabaseErrorLogContext(error)).toEqual({
      name: "Error",
      code: "DRIZZLE_WRAPPER",
      causeCode: "42703",
      message: "wrapper",
      causeMessage: "[credential]=[redacted] [url redacted]",
      diagnostic: "PG:42703:column_missing",
    });
  });

  it("normaliza MAX(createdAt) como Date, string ISO, null ou inválida sem lançar TypeError", () => {
    expect(toSafeIsoDate(new Date("2026-11-26T18:00:00.000Z"))).toBe("2026-11-26T18:00:00.000Z");
    expect(toSafeIsoDate("2026-11-26T18:00:00.000Z")).toBe("2026-11-26T18:00:00.000Z");
    expect(toSafeIsoDate(null)).toBeNull();
    expect(toSafeIsoDate(undefined)).toBeNull();
    expect(toSafeIsoDate("not-a-date")).toBeNull();
  });

  it("não envia uma data inválida ao driver PostgreSQL", () => {
    const date = toPostgresDateParameter("2026-11-26T17:00:00.000Z", "report_cutoff");
    expect(date.toISOString()).toBe("2026-11-26T17:00:00.000Z");
    expect(() => toPostgresDateParameter("not-a-date", "report_cutoff")).toThrow("invalid_report_cutoff_date_parameter");
  });

  it("mantém o contrato das três tabelas alinhado às migrations PostgreSQL", () => {
    const baseline = readSqlFile(new URL("../drizzle/postgres/0000_postgres_baseline.sql", import.meta.url), "utf8");
    const compatibility = readSqlFile(new URL("../drizzle/postgres/0006_operational_schema_compatibility.sql", import.meta.url), "utf8");
    for (const [table, columns] of Object.entries(OPERATIONAL_SCHEMA_COLUMNS)) {
      expect(`${baseline}\n${compatibility}`).toContain(`"${table}"`);
      for (const column of columns) expect(`${baseline}\n${compatibility}`).toContain(`"${column}"`);
    }
  });
});
