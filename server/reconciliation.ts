export const BAIXADA_SANTISTA_BOUNDS = {
  minLatitude: -24.15,
  maxLatitude: -23.85,
  minLongitude: -46.45,
  maxLongitude: -46.05,
} as const;

export type ReconciliationInput = {
  read?: number;
  filtered?: number;
  persisted?: number;
  duplicates?: number;
  missingCoordinates?: number;
  outOfBoundsCoordinates?: number;
  skippedByReason?: Record<string, number>;
  degraded?: boolean;
  retries?: number;
  fallbackList?: number;
};

export type ReconciliationResult = {
  counts: { read: number; filtered: number; persisted: number };
  duplicates: number;
  missingCoordinates: number;
  outOfBoundsCoordinates: number;
  skippedByReason: Record<string, number>;
  allKnownSkipped: number;
  reconciliationGap: number;
  degraded: boolean;
  retries: number;
  fallbackList: number;
  consistent: boolean;
  issues: string[];
};

const safeCount = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

function normalizeSkipReasons(input: Record<string, number> | undefined) {
  const normalized: Record<string, number> = {};
  for (const [reason, value] of Object.entries(input ?? {})) {
    const count = safeCount(value);
    if (count > 0) normalized[String(reason).trim().slice(0, 80)] = count;
  }
  return normalized;
}

function capSkipReasons(input: Record<string, number>, maximum: number) {
  let remaining = Math.max(0, safeCount(maximum));
  const capped: Record<string, number> = {};
  for (const [reason, count] of Object.entries(input)) {
    if (remaining <= 0) break;
    const accepted = Math.min(safeCount(count), remaining);
    if (accepted > 0) {
      capped[reason] = accepted;
      remaining -= accepted;
    }
  }
  return capped;
}

export function isRegionalCoordinate(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= BAIXADA_SANTISTA_BOUNDS.minLatitude && lat <= BAIXADA_SANTISTA_BOUNDS.maxLatitude
    && lng >= BAIXADA_SANTISTA_BOUNDS.minLongitude && lng <= BAIXADA_SANTISTA_BOUNDS.maxLongitude;
}

export function reconcileIngestionResult(input: ReconciliationInput): ReconciliationResult {
  const read = safeCount(input.read);
  const persisted = safeCount(input.persisted);
  const suppliedReasons = normalizeSkipReasons(input.skippedByReason);
  const hasReasonBreakdown = Object.keys(suppliedReasons).length > 0;
  const duplicates = safeCount(input.duplicates);
  const filteredCapacity = Math.max(0, read - persisted - duplicates);
  const cappedReasons = capSkipReasons(suppliedReasons, filteredCapacity);
  const legacyFiltered = Math.min(safeCount(input.filtered), filteredCapacity);
  const filtered = hasReasonBreakdown ? Object.values(cappedReasons).reduce((sum, count) => sum + count, 0) : legacyFiltered;
  const missingCoordinates = safeCount(input.missingCoordinates);
  const outOfBoundsCoordinates = safeCount(input.outOfBoundsCoordinates);
  const retries = safeCount(input.retries);
  const fallbackList = safeCount(input.fallbackList);
  const skippedByReason = hasReasonBreakdown ? cappedReasons : (filtered > 0 ? { filtered: filtered } : {});
  const allKnownSkipped = Object.values(skippedByReason).reduce((sum, count) => sum + count, 0);
  const reconciliationGap = read - persisted - allKnownSkipped;
  const issues: string[] = [];

  if (safeCount(input.filtered) > filteredCapacity || Object.values(suppliedReasons).reduce((sum, count) => sum + count, 0) > filteredCapacity) issues.push("filtered_exceeds_read");
  if (persisted > read) issues.push("persisted_exceeds_read");
  if (duplicates > persisted && !hasReasonBreakdown) issues.push("duplicates_exceeds_persisted");
  if (missingCoordinates > persisted && !hasReasonBreakdown) issues.push("missing_coordinates_exceeds_persisted");
  if (outOfBoundsCoordinates > persisted && !hasReasonBreakdown) issues.push("out_of_bounds_exceeds_persisted");
  if (reconciliationGap !== 0) issues.push("reconciliation_gap");
  if (input.degraded === true && persisted > 0) issues.push("degraded_run_persisted_events");

  return {
    counts: { read, filtered, persisted },
    duplicates,
    missingCoordinates,
    outOfBoundsCoordinates,
    skippedByReason,
    allKnownSkipped,
    reconciliationGap,
    degraded: input.degraded === true,
    retries,
    fallbackList,
    consistent: issues.length === 0,
    issues,
  };
}
