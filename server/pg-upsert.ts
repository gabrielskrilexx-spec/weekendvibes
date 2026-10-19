export function upsert<TBuilder>(builder: TBuilder, target: unknown, set: Record<string, unknown>) {
  const candidate = builder as TBuilder & {
    onConflictDoUpdate?: (config: { target: unknown; set: Record<string, unknown> }) => unknown;
    onDuplicateKeyUpdate?: (config: { set: Record<string, unknown> }) => unknown;
  };
  if (typeof candidate.onConflictDoUpdate === "function") {
    return candidate.onConflictDoUpdate({ target, set });
  }
  if (typeof candidate.onDuplicateKeyUpdate === "function") {
    return candidate.onDuplicateKeyUpdate({ set });
  }
  throw new Error("Database insert builder does not support PostgreSQL conflict handling");
}
