import { fetchIngresseEventApi } from "../server/ingestion.ts";
import { persistManualReviewEvents } from "../server/manual-review.ts";

const canonicalUrl = "https://www.ingresse.com/mimada-casa-412/";

function sanitize(value: unknown) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, "[url]" )
    .replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 240);
}

try {
  const result = await fetchIngresseEventApi(canonicalUrl, undefined, { dryRun: true });
  const structured = result.structured;
  if (!structured?.title || !structured.eventDate || !structured.locationName) {
    throw new Error("A extração não retornou título, data e local suficientes para a fila manual.");
  }

  const persisted = await persistManualReviewEvents([{
    title: structured.title,
    summary: result.text,
    eventDate: structured.eventDate,
    locationName: structured.locationName,
    address: structured.address,
    city: structured.city,
    category: "evento_musical",
    priceCents: structured.priceCents,
    sourceUrl: canonicalUrl,
    sourceType: "public:ingresse",
    imageUrl: result.imageUrl || structured.imageUrl,
    rawText: result.text,
    reason: "Ingestão manual pontual da URL Ingresse; revisão operacional",
  }]);

  console.log(JSON.stringify({
    ok: true,
    httpStatus: 200,
    source: "public:ingresse",
    url: canonicalUrl,
    queued: persisted.inserted,
    title: structured.title,
    eventDate: structured.eventDate,
    locationName: structured.locationName,
    city: structured.city,
    hasImage: Boolean(result.imageUrl || structured.imageUrl),
    apifyUsed: false,
  }, null, 2));
} catch (error) {
  const failure = (error && typeof error === "object" ? error as { fetchFailure?: { status?: number; message?: string }; cacheFallback?: boolean } : {});
  console.error(JSON.stringify({
    ok: false,
    httpStatus: failure.fetchFailure?.status ?? null,
    url: canonicalUrl,
    message: sanitize(failure.fetchFailure?.message ?? (error instanceof Error ? error.message : error)),
    cacheFallback: Boolean(failure.cacheFallback),
    apifyUsed: false,
  }, null, 2));
  process.exitCode = 1;
}
