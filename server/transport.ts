export function normalizeJsonForTransport<T>(value: T): T {
  const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (typeof nestedValue === "bigint") return Number(nestedValue);
    if (nestedValue instanceof Error) {
      return {
        name: nestedValue.name,
        message: nestedValue.message.slice(0, 240),
      };
    }
    return nestedValue;
  });
  return (serialized === undefined ? value : JSON.parse(serialized)) as T;
}

export function isoOrNull(
  value: Date | string | number | null | undefined
): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
