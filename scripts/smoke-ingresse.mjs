import { fetchIngresseEventApi } from "../server/ingestion.ts";

const url = process.env.INGRESSE_SMOKE_URL?.trim() || "https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/";

try {
  const result = await fetchIngresseEventApi(url, undefined, { dryRun: true });
  console.log(JSON.stringify({
    ok: true,
    httpStatus: 200,
    url,
    structured: Boolean(result.structured),
    title: result.structured?.title ?? null,
    city: result.structured?.city ?? null,
    eventDate: result.structured?.eventDate ?? null,
    hasImage: Boolean(result.imageUrl || result.structured?.imageUrl),
  }, null, 2));
} catch (error) {
  const failure = error?.fetchFailure;
  console.error(JSON.stringify({
    ok: false,
    httpStatus: failure?.status ?? error?.status ?? null,
    url,
    message: String(failure?.message ?? error?.message ?? error).replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]").slice(0, 240),
    cacheFallback: Boolean(error?.cacheFallback),
  }, null, 2));
  process.exitCode = 1;
}
