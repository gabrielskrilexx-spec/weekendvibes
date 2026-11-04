export type IngestionSourceReportSummary = {
  sourceKey: string;
  message: string;
};

function count(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function collectSourceReports(value: unknown, output: unknown[], depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return;
  if (Array.isArray(value)) {
    for (const item of value) collectSourceReports(item, output, depth + 1);
    return;
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.sourceReports)) output.push(...record.sourceReports);
  for (const [key, child] of Object.entries(record)) {
    if (key !== "sourceReports") collectSourceReports(child, output, depth + 1);
  }
}

export function buildIngestionSourceReportSummaries(details: unknown): IngestionSourceReportSummary[] {
  const reports: unknown[] = [];
  collectSourceReports(details, reports);
  return reports
    .filter((report): report is Record<string, unknown> => Boolean(report) && typeof report === "object" && !Array.isArray(report))
    .flatMap(report => {
      const sourceKey = typeof report.sourceKey === "string" ? report.sourceKey.trim().slice(0, 255) : "";
      if (!sourceKey) return [];
      const errors = Array.isArray(report.errors) ? report.errors.length : 0;
      const message = `${errors > 0 ? "Coleta parcial" : "Coleta concluída"}: ${count(report.read)} lidos, ${count(report.added)} novos, ${count(report.updated)} atualizados, ${count(report.ignored ?? report.filtered)} ignorados; ${errors} erro(s).`;
      return [{ sourceKey, message: message.slice(0, 1000) }];
    });
}
