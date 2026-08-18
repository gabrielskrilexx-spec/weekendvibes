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
  degraded?: boolean;
  retries?: number;
  fallbackList?: number;
};

export type ReconciliationResult = {
  counts: { read: number; filtered: number; persisted: number };
  duplicates: number;
  missingCoordinates: number;
  outOfBoundsCoordinates: number;
  degraded: boolean;
  retries: number;
  fallbackList: number;
  consistent: boolean;
  issues: string[];
};

const safeCount = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

export function isRegionalCoordinate(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= BAIXADA_SANTISTA_BOUNDS.minLatitude && lat <= BAIXADA_SANTISTA_BOUNDS.maxLatitude
    && lng >= BAIXADA_SANTISTA_BOUNDS.minLongitude && lng <= BAIXADA_SANTISTA_BOUNDS.maxLongitude;
}

export function reconcileIngestionResult(input: ReconciliationInput): ReconciliationResult {
  const read = safeCount(input.read);
  const filtered = safeCount(input.filtered);
  const persisted = safeCount(input.persisted);
  const duplicates = safeCount(input.duplicates);
  const missingCoordinates = safeCount(input.missingCoordinates);
  const outOfBoundsCoordinates = safeCount(input.outOfBoundsCoordinates);
  const retries = safeCount(input.retries);
  const fallbackList = safeCount(input.fallbackList);
  const issues: string[] = [];

  if (filtered > read) issues.push("filtered_exceeds_read");
  if (persisted > read) issues.push("persisted_exceeds_read");
  if (duplicates > persisted) issues.push("duplicates_exceeds_persisted");
  if (missingCoordinates > persisted) issues.push("missing_coordinates_exceeds_persisted");
  if (outOfBoundsCoordinates > persisted) issues.push("out_of_bounds_exceeds_persisted");
  if (input.degraded === true && persisted > 0) issues.push("degraded_run_persisted_events");

  return {
    counts: { read, filtered, persisted },
    duplicates,
    missingCoordinates,
    outOfBoundsCoordinates,
    degraded: input.degraded === true,
    retries,
    fallbackList,
    consistent: issues.length === 0,
    issues,
  };
}
