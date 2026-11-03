/** Pure response builder for the lightweight public app-version endpoint. */
export function appVersionResponse(version: string | undefined) {
  return { status: 200 as const, body: { version: version?.trim() || "unknown" } };
}
