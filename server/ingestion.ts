import crypto from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { assertEventDateIsCurrentOrFuture, getIngestionPayloadCache, listActiveLocationAliasValues, saveEvent, saveIngestionPayloadCache } from "./db";

const DEFAULT_SOURCE_URLS = [
  "https://articket.com.br/e/6784/plants-happy-hour",
  "https://articket.com.br/",
  "https://blacktag.com.br/",
  "https://www.ingresse.com/reveillon-guaruja-2027/",
  "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/",
  "https://www.ingresse.com/nosso-after-mc-luuky/",
  "https://www.ingresse.com/nosso-after-14-08/",
  "https://www.ingresse.com/",
];

export const TARGET_VENUES = [
  "valluns garden",
  "vallum garden",
  "lucky scope",
  "verilonguinho",
  "moby house",
  "moby dick",
  "curvão surf house",
  "curvao surf house",
  "curvão",
  "curvao",
  "meu lugar",
  "laroc club guaruja",
  "laroc guaruja",
  "guaruja golf club",
] as const;

const normalizeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const stripHtml = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
const INGRESSE_SITE_API = "https://api-site.ingresse.com/events";

type FetchFailure = { status: number | null; message: string };
type IngresseCacheStore = {
  read: typeof getIngestionPayloadCache;
  write: typeof saveIngestionPayloadCache;
};

function getHttpStatus(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number") return Number((error as { statusCode: number }).statusCode);
  const match = String(error instanceof Error ? error.message : error).match(/\b(?:HTTP|status|respondeu)\s*(\d{3})\b/i);
  return match ? Number(match[1]) : null;
}

export function sanitizeFetchFailure(error: unknown): FetchFailure {
  const status = getHttpStatus(error);
  const raw = error instanceof Error ? error.message : String(error ?? "Falha desconhecida");
  const message = raw.replace(/https?:\/\/[^\s]+/gi, "fonte pública").replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 240);
  return { status, message: message || "Falha de coleta da fonte pública" };
}

function createFetchError(message: string, statusCode: number | null = null) {
  const error = new Error(message) as Error & { statusCode?: number };
  if (statusCode !== null) error.statusCode = statusCode;
  return error;
}

function ingresseCacheKey(url: string) {
  return `ingresse:${normalizeSlug(getIngresseSlug(url))}`;
}

export function getConfiguredSourceUrls() {
  const focused = process.env.INGESTION_FOCUS_URLS;
  if (focused !== undefined) return Array.from(new Set(focused.split(",").map(value => value.trim()).filter(Boolean)));
  const configured = process.env.INGESTION_SOURCE_URL ?? process.env.INGESTION_SOURCE_URLS;
  if (configured !== undefined) {
    let configuredUrls: string[];
    try {
      const parsed = JSON.parse(configured);
      configuredUrls = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").map(value => value.trim()).filter(Boolean) : [];
    } catch {
      configuredUrls = configured.split(",").map(value => value.trim()).filter(Boolean);
    }
    if (configuredUrls.length === 0) return [];
    return Array.from(new Set([...configuredUrls, ...DEFAULT_SOURCE_URLS]));
  }
  return DEFAULT_SOURCE_URLS;
}

export function containsTargetVenue(value: string, aliases: string[] = []) {
  const normalized = normalizeText(value);
  return [...TARGET_VENUES, ...aliases].some(venue => normalized.includes(normalizeText(venue)));
}

export function extractPublicEventLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const absoluteBase = new URL(baseUrl);
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], absoluteBase);
      if (url.origin !== absoluteBase.origin) continue;
      const isArticket = url.pathname.startsWith("/e/") && url.hostname.includes("articket");
      const isBlacktag = url.pathname.startsWith("/eventos/") && url.hostname.includes("blacktag");
      const isIngresseEvent = url.hostname.includes("ingresse") && url.pathname !== "/" && !url.pathname.startsWith("/search");
      if (isArticket || isBlacktag || isIngresseEvent) links.add(url.href);
    } catch {
      // Ignore malformed public links.
    }
  }
  return Array.from(links).slice(0, 40);
}

function isIngresseEventUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    return parsed.hostname.endsWith("ingresse.com") && path.length > 1 && !["/login", "/register", "/search"].includes(path);
  } catch {
    return false;
  }
}

function getIngresseSlug(url: string) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? "");
}

export async function fetchIngresseEventApi(url: string, cacheStore: IngresseCacheStore = { read: getIngestionPayloadCache, write: saveIngestionPayloadCache }) {
  const slug = getIngresseSlug(url);
  if (!slug) throw createFetchError(`URL Ingresse sem slug de evento: ${url}`);
  try {
    const response = await fetch(`${INGRESSE_SITE_API}/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json", "user-agent": "WeekendVibesBot/1.0 (+public-event-ingestion)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw createFetchError(`API pública do Ingresse respondeu ${response.status}`, response.status);
    const payload = await response.json() as Record<string, unknown>;
    const place = payload.place && typeof payload.place === "object" ? payload.place as Record<string, unknown> : {};
    const session = Array.isArray(payload.sessions) && payload.sessions[0] && typeof payload.sessions[0] === "object" ? payload.sessions[0] as Record<string, unknown> : {};
    const location = place.location && typeof place.location === "object" ? place.location as Record<string, unknown> : {};
    const title = typeof payload.title === "string" ? payload.title : "";
    const description = typeof payload.description === "string" ? stripHtml(payload.description) : "";
    const placeName = typeof place.name === "string" ? place.name : "";
    const city = typeof place.city === "string" ? place.city : "";
    const address = [place.street, city, place.state].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(", ");
    const dateTime = typeof session.dateTime === "string" ? session.dateTime : "";
    const poster = payload.poster && typeof payload.poster === "object" ? payload.poster as Record<string, unknown> : {};
    const imageUrl = [poster.large, poster.medium, poster.small].find((value): value is string => typeof value === "string" && value.startsWith("http")) ?? "";
    const latitude = typeof location.lat === "number" ? String(location.lat) : "";
    const longitude = typeof location.lon === "number" ? String(location.lon) : "";
    const text = [title, description, placeName, address, city, dateTime].filter(Boolean).join(" ");
    if (!title || !dateTime || !placeName) throw createFetchError(`API pública do Ingresse sem dados essenciais para ${url}`);
    const structured = { title, summary: description, eventDate: dateTime, locationName: placeName, address, city, category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: url, imageUrl, latitude, longitude };
    await cacheStore.write({ cacheKey: ingresseCacheKey(url), sourceKey: "public:ingresse", sourceUrl: url, payload: structured, latitude, longitude }).catch(error => console.warn("[Ingestion cache] Could not save Ingresse payload:", sanitizeFetchFailure(error).message));
    return { url, html: "", text: text.slice(0, 16_000), imageUrl, structured };
  } catch (error) {
    const failure = sanitizeFetchFailure(error);
    const cached = await cacheStore.read(ingresseCacheKey(url)).catch(() => undefined);
    if (cached) {
      try {
        const structured = JSON.parse(cached.payload) as Record<string, string | number>;
        const text = Object.values(structured).filter(value => typeof value === "string").join(" ");
        return { url, html: "", text: text.slice(0, 16_000), imageUrl: String(structured.imageUrl ?? ""), structured, cacheFallback: { used: true as const, status: failure.status, message: failure.message }, fetchFailure: failure };
      } catch {
        // Ignore malformed cache and preserve the original fetch failure.
      }
    }
    throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure });
  }
}

async function fetchPublicPage(url: string) {
  if (isIngresseEventUrl(url)) return fetchIngresseEventApi(url);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "WeekendVibesBot/1.0 (+public-event-ingestion)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw createFetchError(`Fonte pública respondeu ${response.status}`, response.status);
    const html = await response.text();
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) throw createFetchError("Fonte pública retornou conteúdo vazio");
    return { url, html, text: text.slice(0, 8000), imageUrl: imageMatch?.[1] ?? "" };
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(sanitizeFetchFailure(error).message), { fetchFailure: sanitizeFetchFailure(error) });
  }
}

async function discoverCandidatePages() {
  const bases = getConfiguredSourceUrls();
  const discovered = new Set(bases);
  const basePages = await Promise.allSettled(bases.map(fetchPublicPage));
  for (const result of basePages) {
    if (result.status !== "fulfilled") continue;
    for (const link of extractPublicEventLinks(result.value.html, result.value.url)) discovered.add(link);
  }
  return Array.from(discovered).slice(0, 60);
}

export async function runIngestionPipeline() {
  const activeAliases = await listActiveLocationAliasValues();
  const matchesTargetVenue = (value: string) => containsTargetVenue(value, activeAliases);
  const candidateUrls = await discoverCandidatePages();
  if (candidateUrls.length === 0) return { imported: 0, skipped: true, reason: "Nenhuma fonte de ingestão configurada" };
  const pages = await Promise.allSettled(candidateUrls.map(fetchPublicPage));
  const fulfilledPages = pages
    .filter((result): result is PromiseFulfilledResult<{ url: string; html: string; text: string; imageUrl: string; structured?: Record<string, string | number>; cacheFallback?: { used: true; status: number | null; message: string }; fetchFailure?: FetchFailure }> => result.status === "fulfilled")
    .map(result => result.value);
  const fallbackPages = fulfilledPages.filter(page => page.cacheFallback?.used);
  const rejectedPages = pages.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  const fetchFailures = [
    ...fallbackPages.map(page => ({ sourceUrl: page.url, ...page.cacheFallback, status: page.cacheFallback?.status ?? null })),
    ...rejectedPages.map((result, index) => ({ sourceUrl: candidateUrls[index], ...sanitizeFetchFailure(result.reason) })),
  ].map(failure => ({ sourceUrl: String(failure.sourceUrl).slice(0, 1000), status: failure.status ?? null, message: String(failure.message).slice(0, 240), fallbackUsed: "used" in failure && failure.used === true }));
  const fetchFailed = fetchFailures.length;
  const outsideTargetVenue = fulfilledPages.filter(page => !matchesTargetVenue(page.text)).length;
  const sourcePages = fulfilledPages.filter(page => matchesTargetVenue(page.text));
  const filteredByReason = { fetchFailed, outsideTargetVenue, invalidStructuredEvent: 0 };
  const filteredSourceUrls = pages.flatMap((result, index) => result.status === "rejected" || !matchesTargetVenue(result.status === "fulfilled" ? result.value.text : "") ? [candidateUrls[index]] : []);

  if (sourcePages.length === 0) {
    return { imported: 0, persisted: 0, read: candidateUrls.length, filtered: candidateUrls.length, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, skipped: false, discovered: candidateUrls.length, matchedSources: 0, fallbackUsed: fallbackPages.length, fetchFailures, filteredByReason, filteredSourceUrls, reason: "Nenhum evento dos locais-alvo encontrado nas fontes públicas" };
  }

  const apiStructuredEvents = sourcePages
    .flatMap(page => "structured" in page && page.structured ? [page.structured] : []);
  const rawText = sourcePages
    .map(page => `SOURCE_URL: ${page.url}\nIMAGE_URL: ${page.imageUrl}\nCONTENT: ${page.text}`)
    .join("\n\n")
    .slice(0, 48_000);

  const structured = apiStructuredEvents.length > 0 ? { choices: [{ message: { content: JSON.stringify({ events: apiStructuredEvents }) } }] } : await invokeLLM({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Extraia somente eventos públicos de música, shows ou baladas dos locais Valluns/Vallum Garden, Lucky Scope, Verilonguinho, Moby House/Moby Dick, Curvão Surf House, Meu Lugar, Laroc Club Guarujá ou Guarujá Golf Club, localizados exclusivamente em Santos ou Guarujá. Ignore eventos passados, cidades diferentes, locais não-alvo e eventos de gastronomia, esporte, teatro ou exposição sem música. Retorne somente JSON no schema. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Se o gênero não puder ser inferido com segurança, descarte o evento. Use o SOURCE_URL correspondente como sourceUrl e IMAGE_URL quando houver." },
      { role: "user", content: rawText },
    ],
    response_format: { type: "json_schema", json_schema: { name: "event_batch", strict: true, schema: { type: "object", properties: { events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string" }, category: { type: "string", enum: ["show", "balada", "evento_musical"] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] }, priceCents: { type: "integer" }, sourceUrl: { type: "string" }, imageUrl: { type: "string" }, latitude: { type: "string" }, longitude: { type: "string" } }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "genre", "priceCents", "sourceUrl", "imageUrl", "latitude", "longitude"], additionalProperties: false } } }, required: ["events"], additionalProperties: false } } },
  });

  const payload = JSON.parse(String(structured.choices?.[0]?.message?.content ?? "{\"events\":[]}")) as { events: Array<Record<string, string | number>> };
  let imported = 0;
  let duplicates = 0;
  let missingCoordinates = 0;
  let outOfBoundsCoordinates = 0;
  for (const event of payload.events) {
    const date = new Date(String(event.eventDate));
    const city = String(event.city);
    const category = String(event.category);
    const genre = String(event.genre);
    if (Number.isNaN(date.getTime()) || (city !== "Santos" && city !== "Guarujá") || !matchesTargetVenue(`${event.locationName} ${event.address}`) || !["show", "balada", "evento_musical"].includes(category) || !["funk", "house_eletronica", "samba_pagode", "rap_trap"].includes(genre)) {
      filteredByReason.invalidStructuredEvent += 1;
      continue;
    }
    try { assertEventDateIsCurrentOrFuture(date, new Date(), String(event.title)); } catch { filteredByReason.invalidStructuredEvent += 1; continue; }
    const sourceHash = crypto.createHash("md5").update(`${normalizeSlug(String(event.sourceUrl))}:${normalizeSlug(String(event.title))}:${date.toISOString().slice(0, 10)}`).digest("hex");
    const sourceUrl = String(event.sourceUrl);
    const sourceType = sourceUrl.includes("ingresse.com") ? "ingresse" : "public_source";
    const latitude = String(event.latitude || "");
    const longitude = String(event.longitude || "");
    if (!latitude || !longitude) missingCoordinates += 1;
    else {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!(lat >= -24.15 && lat <= -23.85 && lng >= -46.45 && lng <= -46.05)) outOfBoundsCoordinates += 1;
    }
    const saved = await saveEvent({ title: String(event.title), slug: `${normalizeSlug(String(event.title))}-${date.getTime()}`, description: String(event.summary), eventDate: date, locationName: String(event.locationName), address: String(event.address), city, category: category as "show" | "balada" | "evento_musical", genre, priceCents: Number(event.priceCents) || 0, sourceUrl, sourceType, imageUrl: String(event.imageUrl || ""), latitude, longitude, sourceHash, isPublished: 1 });
    if (saved?.created === false) duplicates += 1;
    imported += 1;
  }
  return { imported, persisted: imported, read: candidateUrls.length, filtered: Math.max(0, candidateUrls.length - sourcePages.length), duplicates, missingCoordinates, outOfBoundsCoordinates, skipped: false, discovered: candidateUrls.length, matchedSources: sourcePages.length, fallbackUsed: fallbackPages.length, fetchFailures, filteredByReason, filteredSourceUrls };
}
