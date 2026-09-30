import type { FreshnessState } from "./ingestion-reports.js";

export type AutomaticAlert = {
  integration: "pipeline";
  title: string;
  message: string;
  severity: "WARNING" | "CRITICAL";
  alertType: "freshness_critical" | "reconciliation_divergence" | "structured_not_persisted";
  slaMinutes: number;
};

export type FreshnessAlertInput = {
  sourceKey: string;
  sourceName: string;
  state: FreshnessState;
  lastSuccessAt: Date | string | null | undefined;
  expectedMinutes: number;
  now?: Date;
};

export function buildFreshnessCriticalAlert(input: FreshnessAlertInput): AutomaticAlert | null {
  if (input.state !== "critical") return null;
  const lastSuccess = input.lastSuccessAt ? new Date(input.lastSuccessAt).getTime() : 0;
  const ageMinutes = lastSuccess > 0 && input.now
    ? Math.max(0, Math.round((input.now.getTime() - lastSuccess) / 60000))
    : null;
  const ageLabel = ageMinutes === null ? "sem sincronização bem-sucedida registrada" : `${ageMinutes} minutos desde a última sincronização bem-sucedida`;
  return {
    integration: "pipeline",
    title: `Freshness crítico: ${input.sourceName}`,
    message: `A fonte ${input.sourceKey} está em estado crítico (${ageLabel}; expectativa de ${Math.max(60, input.expectedMinutes)} minutos). Verifique a origem e a próxima execução agendada.`,
    severity: "CRITICAL",
    alertType: "freshness_critical",
    slaMinutes: 60,
  };
}

export type StructuredPersistenceMismatchInput = {
  sourceKey: string;
  routineName?: string;
  runId?: number | string;
  structured: number;
  persisted: number;
  rejectionReasons?: Record<string, number>;
};

export function buildStructuredPersistenceMismatchAlert(input: StructuredPersistenceMismatchInput): AutomaticAlert | null {
  if (input.structured <= 0 || input.persisted > 0) return null;
  const reasons = Object.entries(input.rejectionReasons ?? {})
    .filter(([, count]) => Number(count) > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");
  return {
    integration: "pipeline",
    title: `Eventos estruturados não persistidos: ${input.sourceKey}`,
    message: `A rotina ${input.routineName ?? input.sourceKey} (fonte ${input.sourceKey}) estruturou ${input.structured} evento(s), mas persistiu ${input.persisted}. ${reasons ? `Motivos registrados: ${reasons}. ` : ""}Revise a validação final dos dados antes de repetir a ingestão.`,
    severity: "WARNING",
    alertType: "structured_not_persisted",
    slaMinutes: 240,
  };
}

export type ReconciliationAlertInput = {
  sourceKey: string;
  runId?: number | string;
  consistent: boolean;
  issues: string[];
  persisted: number;
  read: number;
  duplicates: number;
  missingCoordinates: number;
  outOfBoundsCoordinates: number;
  allKnownSkipped?: number;
  reconciliationGap?: number;
};

export function buildReconciliationDivergenceAlert(input: ReconciliationAlertInput): AutomaticAlert | null {
  const issues = Array.from(new Set(input.issues.filter(Boolean))).sort();
  const gap = Number.isFinite(input.reconciliationGap) ? Number(input.reconciliationGap) : null;
  if (gap === 0 && issues.every(issue => issue !== "reconciliation_gap")) return null;
  if (input.consistent && issues.length === 0) return null;
  const critical = issues.some(issue => ["persisted_exceeds_read", "duplicates_exceeds_persisted", "degraded_run_persisted_events"].includes(issue));
  return {
    integration: "pipeline",
    title: `Divergência de reconciliação: ${input.sourceKey}`,
    message: `A fonte ${input.sourceKey} apresentou divergência (${issues.length ? issues.join(", ") : "inconsistente"}). Revise read=${input.read}, persisted=${input.persisted}, duplicates=${input.duplicates}, missingCoordinates=${input.missingCoordinates}, outOfBoundsCoordinates=${input.outOfBoundsCoordinates}.`,
    severity: critical ? "CRITICAL" : "WARNING",
    alertType: "reconciliation_divergence",
    slaMinutes: critical ? 60 : 240,
  };
}
