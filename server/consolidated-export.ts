export type ConsolidatedSourceRow = {
  sourceKey: string;
  name: string;
  kind: string;
  handle?: string | null;
  url?: string | null;
  isEnabled: boolean;
  lastStatus: string;
  lastAttemptAt?: string | Date | null;
  lastSuccessAt?: string | Date | null;
  lastFailureReason?: string | null;
  lastHttpStatus?: number | null;
  circuitState: string;
  circuitFailureCount: number;
  circuitNextAttemptAt?: string | Date | null;
  consecutive403Count: number;
};

export type ConsolidatedCatalogReport = {
  generatedAt: string;
  totalSources: number;
  activeSources: number;
  pausedSources: number;
  sources: ConsolidatedSourceRow[];
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function dateValue(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : value ?? "";
}

export function consolidatedCatalogToCsv(report: ConsolidatedCatalogReport) {
  const headers = ["sourceKey", "nome", "tipo", "handle", "url", "ativa", "ultimoStatus", "ultimaTentativa", "ultimoSucesso", "motivoFalha", "httpStatus", "circuitBreaker", "falhasConsecutivas", "proximaTentativa", "bloqueios403"];
  const rows = report.sources.map(source => [
    source.sourceKey,
    source.name,
    source.kind,
    source.handle,
    source.url,
    source.isEnabled ? "sim" : "não",
    source.lastStatus,
    dateValue(source.lastAttemptAt),
    dateValue(source.lastSuccessAt),
    source.lastFailureReason,
    source.lastHttpStatus,
    source.circuitState,
    source.circuitFailureCount,
    dateValue(source.circuitNextAttemptAt),
    source.consecutive403Count,
  ]);
  return `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function consolidatedCatalogFilename(date = new Date(), format: "csv" | "json" = "json") {
  return `catalogo_consolidado_${date.toISOString().slice(0, 10)}.${format}`;
}
