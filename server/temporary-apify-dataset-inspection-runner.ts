const DATASET_ID = "cjjIAQb1VIPWsXtMc";

function summarizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null) return value === null ? null : "[nested]";
  if (Array.isArray(value)) return { kind: "array", length: value.length, first: value.length > 0 ? summarizeValue(value[0], depth + 1) : undefined };
  if (typeof value !== "object") {
    if (typeof value === "string") return { kind: "string", length: value.length, looksLikeUrl: /^https?:\/\//i.test(value), preview: value.length <= 80 && !/^https?:\/\//i.test(value) ? value : undefined };
    return { kind: typeof value };
  }
  const record = value as Record<string, unknown>;
  return { kind: "object", keys: Object.keys(record).slice(0, 80), fields: Object.fromEntries(Object.entries(record).slice(0, 80).map(([key, item]) => [key, summarizeValue(item, depth + 1)])) };
}

export async function temporaryApifyDatasetInspectionHandler(_req: any, res: any) {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return res.status(503).json({ ok: false, error: "APIFY_TOKEN_MISSING" });
  const response = await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(DATASET_ID)}/items?clean=false&limit=10&offset=0`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "User-Agent": "WeekendVibes/1.0" } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload)) return res.status(502).json({ ok: false, error: "DATASET_READ_FAILED", status: response.status, payloadKind: typeof payload });
  return res.status(200).json({ ok: true, datasetId: DATASET_ID, itemCount: payload.length, items: payload.map(item => summarizeValue(item)) });
}
