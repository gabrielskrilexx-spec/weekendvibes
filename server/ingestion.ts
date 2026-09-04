import crypto from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { assertEventDateIsCurrentOrFuture, getIngestionPayloadCache, listActiveLocationAliasValues, saveEvent, saveIngestionPayloadCache } from "./db";
import { allowSourceAttempt, registerSourceFailure, registerSourceSuccess } from "./circuit-breaker";
import { fetchExternal, isSandboxRestrictedError, readExternalBody, sanitizeExternalFetchError } from "./external-fetch";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings";

const DEFAULT_SOURCE_URLS = [
  "https://articket.com.br/e/6784/plants-happy-hour",
  "https://articket.com.br/",
  "https://blacktag.com.br/",
  "https://www.ingresse.com/reveillon-guaruja-2027/",
  "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/",
  "https://www.ingresse.com/nosso-after-mc-luuky/",
  "https://www.ingresse.com/nosso-after-14-08/",
  "https://www.ingresse.com/",
  "https://blackpass.com.br/",
  "https://mringressos.com.br/",
];

export const TARGET_VENUES = [
  "vallum garden",
  "valluns garden",
  "moby dick",
  "moby house",
  "ativa house",
  "casa 412",
  "casa412",
  "verilonguinho",
  "meu lugar",
  "goat club",
  "goat dining club",
  "laroc club guaruja",
  "laroc guaruja",
  "lucky scope",
  "curvão surf house",
  "curvao surf house",
  "curvão",
  "curvao",
  "guarujá golf club",
  "praiô",
  "praio",
  "flamingos",
  "flamingo",
  "projac bar",
  "boteco almare",
  "dolores restaurante e bar",
  "dolores bar e restaurante",
  "arena jequitimar",
] as const;

const normalizeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const stripHtml = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
const INGRESSE_SITE_API = "https://api-site.ingresse.com/events";

function verboseDryRunEnabled() {
  return process.env.INGESTION_VERBOSE_DRY_RUN === "1";
}

function logPublicResponseDiagnostics(input: { url: string; status: number; contentType: string | null; html: string; text: string; structured: boolean; links: number }) {
  if (!verboseDryRunEnabled()) return;
  const parsedUrl = new URL(input.url);
  const jsonLdCount = (input.html.match(/application\/ld\+json/gi) ?? []).length;
  console.info("[Ingestion dry-run] public response", {
    host: parsedUrl.hostname,
    path: parsedUrl.pathname.slice(0, 180),
    status: input.status,
    contentType: input.contentType?.split(";")[0] ?? null,
    bytes: Buffer.byteLength(input.html, "utf8"),
    textLength: input.text.length,
    jsonLdCount,
    discoveredEventLinks: input.links,
    structuredMetadata: input.structured,
  });
}

function logPublicFailureDiagnostics(url: string, error: unknown) {
  if (!verboseDryRunEnabled()) return;
  const parsedUrl = new URL(url);
  const failure = sanitizeFetchFailure(error);
  console.info("[Ingestion dry-run] public failure", {
    host: parsedUrl.hostname,
    path: parsedUrl.pathname.slice(0, 180),
    status: failure.status,
    reason: failure.message,
  });
}


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
  if (focused !== undefined) {
    const focusUrls = focused.split(",").map(value => value.trim()).filter(value => value && value.toUpperCase() !== "DISABLED");
    if (focusUrls.length > 0) return Array.from(new Set(focusUrls));
  }
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

function tokenizeForSimilarity(value: string) {
  return new Set(normalizeSlug(value).split("-").filter(token => token.length > 2));
}

export function areFuzzyDuplicateEvents(left: { title: string; eventDate: Date; city: string }, right: { title: string; eventDate: Date; city: string }) {
  if (left.city !== right.city) return false;
  if (Math.abs(left.eventDate.getTime() - right.eventDate.getTime()) > 36 * 60 * 60 * 1000) return false;
  const a = tokenizeForSimilarity(left.title);
  const b = tokenizeForSimilarity(right.title);
  if (a.size === 0 || b.size === 0) return false;
  const intersection = Array.from(a).filter(token => b.has(token)).length;
  const union = new Set([...Array.from(a), ...Array.from(b)]).size;
  return union > 0 && intersection / union >= 0.7;
}

export function normalizeVenueCity(locationName: string, address: string, city: string) {
  const venue = normalizeText(`${locationName} ${address}`);
  return /vallum|valluns/.test(venue) && /garden/.test(venue) ? "Santos" : city;
}

export function extractPublicEventLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const absoluteBase = new URL(baseUrl);
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], absoluteBase);
      if (url.origin !== absoluteBase.origin) continue;
      const isArticket = url.pathname.startsWith("/e/") && url.hostname.includes("articket");
      const isBlacktag = url.pathname.startsWith("/eventos/") && url.hostname.includes("blacktag");
      const isZig = url.pathname.startsWith("/eventos/") && (url.hostname === "zig.tickets" || url.hostname.endsWith(".zig.tickets"));
      const isIngresseEvent = url.hostname.includes("ingresse") && url.pathname !== "/" && !url.pathname.startsWith("/search");
      const isBlackPass = url.hostname.endsWith("blackpass.com.br") && /^\/event\/[A-Za-z0-9_-]+/.test(url.pathname);
      const isMrIngressos = url.hostname.endsWith("mringressos.com.br") && /^\/comprar\/[A-Za-z0-9_-]+/.test(url.pathname);
      const anchorText = stripHtml(match[2]);
      const isZigRegional = !isZig || /santos|guaruj[aá]/i.test(normalizeText(anchorText));
      if ((isArticket || isBlacktag || isZig || isIngresseEvent || isBlackPass || isMrIngressos) && isZigRegional) links.add(url.href);
    } catch {
      // Ignore malformed public links.
    }
  }
  const rawPathPattern = /(?:href|url|link)=["'\\]*(\/event\/[A-Za-z0-9_-]+|\/comprar\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?)/gi;
  let rawMatch: RegExpExecArray | null;
  while ((rawMatch = rawPathPattern.exec(html))) {
    try {
      const url = new URL(rawMatch[1], absoluteBase);
      if (url.origin === absoluteBase.origin && (url.pathname.startsWith("/event/") || url.pathname.startsWith("/comprar/"))) links.add(url.href);
    } catch { /* ignore malformed embedded paths */ }
  }
  return Array.from(links).slice(0, 60);
}

function readJsonLd(html: string) {
  const matches = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const event = values.find(value => {
        if (!value || typeof value !== "object") return false;
        const record = value as Record<string, unknown>;
        return String(record["@type"] ?? "").toLowerCase() === "event" || "startDate" in record;
      });
      if (event && typeof event === "object") return event as Record<string, unknown>;
    } catch {
      // Ignore malformed structured data and continue with metadata fallbacks.
    }
  }
  return undefined;
}

export function parseZigEventMetadata(html: string, url: string) {
  const jsonLd = readJsonLd(html);
  const location = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  const offers = jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : {};
  const meta = (property: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ?? "";
  const title = typeof jsonLd?.name === "string" ? jsonLd.name : meta("og:title");
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate : meta("event:start_time");
  const locationName = typeof location.name === "string" ? location.name : "";
  const city = typeof address.addressLocality === "string" ? address.addressLocality : (/guaruj[aá]/i.test(stripHtml(html)) ? "Guarujá" : /santos/i.test(stripHtml(html)) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : "";
  const priceRaw = typeof offers.price === "number" || typeof offers.price === "string" ? String(offers.price) : "";
  const priceCents = priceRaw ? Math.round(Number(priceRaw.replace(/[^0-9,.-]/g, "").replace(",", ".")) * 100) : 0;
  const text = stripHtml(html).replace(/\s+/g, " ").trim();
  if (!title && !eventDate && !locationName) return undefined;
  return { title, eventDate, locationName, address: street, city, priceCents, sourceUrl: url, imageUrl: meta("og:image"), text: text.slice(0, 16_000) };
}

function isBlackPassEventUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("blackpass.com.br") && /^\/event\//.test(parsed.pathname); } catch { return false; }
}

function isBlackPassRootUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("blackpass.com.br") && ["", "/", "/events"].includes(parsed.pathname.replace(/\/$/, "")); } catch { return false; }
}

const BLACKPASS_EVENTS_API = "https://api.blackpass.com.br/events/list";

type BlackPassCatalogEvent = { id?: string | number; title?: string; name?: string; address?: string; address_comp?: string; city?: string; uf?: string; latlng?: string; dates?: Array<{ dstart?: string; dstop?: string; status?: number }>; poster?: { poster_vertical?: string; poster_horizontal?: string } };

function blackPassEventUrl(id: string | number) {
  return `https://blackpass.com.br/event/${encodeURIComponent(String(id))}`;
}

export function parseBlackPassCatalogEvent(event: BlackPassCatalogEvent) {
  const title = String(event.title ?? event.name ?? "").trim();
  const locationName = String(event.address_comp ?? "").trim();
  const address = String(event.address ?? "").trim();
  const rawCity = String(event.city ?? "").trim();
  const venueText = normalizeText(`${locationName} ${address}`);
  const city = /goat/.test(venueText) || /santos/i.test(rawCity) ? "Santos" : /guaruja|guarujá/i.test(rawCity) ? "Guarujá" : rawCity;
  const dateTime = event.dates?.find(item => item.status !== 0)?.dstart ?? event.dates?.[0]?.dstart ?? "";
  const [latitude, longitude] = String(event.latlng ?? "").split(",").map(value => value.trim());
  const imagePath = event.poster?.poster_vertical || event.poster?.poster_horizontal || "";
  const imageUrl = imagePath.startsWith("http") ? imagePath : imagePath ? `https://api.blackpass.com.br${imagePath}` : "";
  if (!event.id || !title || !dateTime || !locationName) return undefined;
  const sourceUrl = blackPassEventUrl(event.id);
  return { title, summary: title, eventDate: dateTime, locationName, address, city, category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl, imageUrl, latitude: latitude ?? "", longitude: longitude ?? "", text: [title, locationName, address, city, dateTime].filter(Boolean).join(" ") };
}

function parseBlackPassCatalogPayload(payload: unknown): BlackPassCatalogEvent[] {
  const candidates = Array.isArray(payload) ? payload : payload && typeof payload === "object" ? ((payload as { data?: unknown; events?: unknown; results?: unknown }).data ?? (payload as { events?: unknown }).events ?? (payload as { results?: unknown }).results) : [];
  if (!Array.isArray(candidates)) throw createFetchError("Adaptador Black Pass recebeu contrato de catálogo inesperado");
  return candidates.filter((item): item is BlackPassCatalogEvent => Boolean(item && typeof item === "object"));
}

async function fetchBlackPassCatalog(): Promise<BlackPassCatalogEvent[]> {
  const response = await fetchExternal(BLACKPASS_EVENTS_API, { headers: { accept: "application/json" } }, 12_000);
  if (!response.ok) throw createFetchError(`API pública do Black Pass respondeu ${response.status}`, response.status);
  return parseBlackPassCatalogPayload(await response.json() as unknown);
}

async function fetchBlackPassEventPage(url: string): Promise<PublicPage> {
  const id = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const event = (await fetchBlackPassCatalog()).find(item => String(item.id) === id);
  const structured = event ? parseBlackPassCatalogEvent(event) : undefined;
  if (!structured) throw createFetchError(`API pública do Black Pass sem dados essenciais para ${url}`);
  return { url, html: "", text: structured.text, imageUrl: structured.imageUrl, structured, adapter: "blackpass" };
}

function isMrIngressosEventUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("mringressos.com.br") && /^\/comprar\//.test(parsed.pathname); } catch { return false; }
}

function isMrIngressosCatalogUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("mringressos.com.br") && ["", "/", "/eventos"].includes(parsed.pathname.replace(/\/$/, "")); } catch { return false; }
}

export function extractMrIngressosListingEvents(html: string, baseUrl = "https://mringressos.com.br/") {
  const events: Array<{ url: string; title: string; text: string }> = [];
  const pattern = /<a\b[^>]*href=["']([^"']*\/comprar\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], baseUrl).href;
      const text = stripHtml(match[2]);
      const heading = match[2].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
      const title = stripHtml(heading ?? "") || text.match(/(?:\d{1,2}h\d{2})\s+(.+?)(?=\s+(?:Dolores|Boteco|Projac|Tardezinha|Amsterdã|Asipavic|Campo|Quintalzinho|Sede Vicente|G\.R\.C\.E\.S\.)\b|\s+-\s+(?:Guarujá|Guaruja|Santos))/i)?.[1]?.trim() || text.slice(0, 160);
      if (title && !events.some(event => event.url === url)) events.push({ url, title: title.slice(0, 160), text: text.slice(0, 1000) });
    } catch { /* ignore malformed listing links */ }
  }
  return events;
}

export function parseBlackPassEventMetadata(html: string, url: string) {
  return parseTicketingEventMetadata(html, url);
}

export function parseMrIngressosEventMetadata(html: string, url: string) {
  return parseTicketingEventMetadata(html, url);
}

export function parseTicketingEventMetadata(html: string, url: string) {
  const jsonLd = readJsonLd(html);
  const location = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  const offers = jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : {};
  const meta = (property: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)`, "i"))?.[1] ?? "";
  const visibleText = stripHtml(html).replace(/\s+/g, " ");
  const h1Text = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = typeof jsonLd?.name === "string" ? jsonLd.name : meta("og:title") || stripHtml(h1Text) || stripHtml(pageTitle);
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate : (meta("event:start_time") || visibleText.match(/(?:sex|sab|dom|seg|ter|qua|qui)[^0-9]{0,20}(\d{1,2})[\/ .-]+([a-záéêç]+|\d{1,2})[^0-9]{0,12}(\d{1,2})h?(\d{2})?/i)?.[0] || "");
  const locationName = typeof location.name === "string" ? location.name : (visibleText.match(/(?:Guarujá|Guaruja|Santos)[^,|]{0,80}/i)?.[0] ?? "").trim();
  const city = typeof address.addressLocality === "string" ? address.addressLocality : (/guaruj[aá]/i.test(visibleText) ? "Guarujá" : /santos/i.test(visibleText) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : "";
  const priceRaw = typeof offers.price === "number" || typeof offers.price === "string" ? String(offers.price) : "";
  const priceCents = priceRaw ? Math.round(Number(priceRaw.replace(/[^0-9,.-]/g, "").replace(",", ".")) * 100) : 0;
  if (!title && !eventDate && !locationName) return undefined;
  return { title, eventDate, locationName, address: street, city, priceCents, sourceUrl: url, imageUrl: meta("og:image"), text: visibleText.slice(0, 16_000) };
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

export async function fetchIngresseEventApi(url: string, cacheStore: IngresseCacheStore = { read: getIngestionPayloadCache, write: saveIngestionPayloadCache }, options: { dryRun?: boolean } = {}) {
  const slug = getIngresseSlug(url);
  if (!slug) throw createFetchError(`URL Ingresse sem slug de evento: ${url}`);
  try {
    const response = await fetchExternal(`${INGRESSE_SITE_API}/${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } }, 12_000, true);
    if (!response.ok) throw createFetchError(`API pública do Ingresse respondeu ${response.status}`, response.status);
    const payload = JSON.parse(await readExternalBody(response)) as Record<string, unknown>;
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
    if (!options.dryRun) await cacheStore.write({ cacheKey: ingresseCacheKey(url), sourceKey: "public:ingresse", sourceUrl: url, payload: structured, latitude, longitude }).catch(error => console.warn("[Ingestion cache] Could not save Ingresse payload:", sanitizeFetchFailure(error).message));
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

type PublicPage = {
  url: string;
  html: string;
  text: string;
  imageUrl: string;
  adapter?: "blackpass" | "mringressos" | "ingresse" | "generic";
  adapterError?: string;
  durationMs?: number;
  structured?: Record<string, string | number>;
  cacheFallback?: { used: true; status: number | null; message: string };
  fetchFailure?: FetchFailure;
  circuitOpen?: boolean;
};

export function publicSourceKey(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("ingresse")) return "public:ingresse";
    if (host.includes("blacktag")) return "public:blacktag";
    if (host.includes("blackpass")) return "public:blackpass";
    if (host.includes("mringressos")) return "public:mringressos";
    if (host.includes("articket")) return "public:articket";
    if (host.endsWith("zig.tickets")) return "public:zig";
  } catch {
    // Keep malformed URLs under the generic public source.
  }
  return "public:unknown";
}

async function guardedFetchPublicPage(url: string, options: { dryRun?: boolean } = {}): Promise<PublicPage> {
  const startedAt = Date.now();
  const sourceKey = publicSourceKey(url);
  if (!options.dryRun) {
    const circuit = await allowSourceAttempt(sourceKey);
    if (!circuit.allowed) return { url, html: "", text: "", imageUrl: "", circuitOpen: true };
  }
  try {
    const page = await fetchPublicPage(url, options);
    if (!options.dryRun) await registerSourceSuccess(sourceKey);
    return { ...page, durationMs: Math.max(0, Date.now() - startedAt) };
  } catch (error) {
    const failure = sanitizeFetchFailure(error);
    logPublicFailureDiagnostics(url, error);
    if (!options.dryRun) await registerSourceFailure({ sourceKey, routine: "public-agenda", status: failure.status ?? undefined, message: failure.message });
    throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure, fetchDurationMs: Math.max(0, Date.now() - startedAt) });
  }
}

const PUBLIC_FETCH_TIMEOUT_MS = 12_000;
export const ARTICKET_FETCH_TIMEOUT_MS = 30_000;
function publicFetchTimeoutMs(url: string) {
  return publicSourceKey(url) === "public:articket" ? ARTICKET_FETCH_TIMEOUT_MS : PUBLIC_FETCH_TIMEOUT_MS;
}
export const MR_INGRESSOS_RETRY_ATTEMPTS = 3;
export const MR_INGRESSOS_RETRY_BASE_DELAY_MS = 250;

export function isTimeoutFailure(error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return name === "TimeoutError" || name === "AbortError" || /timeout|timed out|aborted/i.test(message);
}

export async function fetchMrIngressosWithRetry(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch) {
  let lastError: unknown;
  for (let attempt = 0; attempt < MR_INGRESSOS_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetchImpl(url, init);
    } catch (error) {
      lastError = error;
      if (!isTimeoutFailure(error) || attempt === MR_INGRESSOS_RETRY_ATTEMPTS - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, MR_INGRESSOS_RETRY_BASE_DELAY_MS * (2 ** attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha de timeout no Mr Ingressos");
}
const MR_INGRESSOS_FETCH_TIMEOUT_MS = 20_000;
const PUBLIC_FETCH_CONCURRENCY = 6;

function buildPreviewPublicMockResult(sourceKey: string, candidateCount: number, durationMs: number, dryRun: boolean) {
  return {
    imported: 0,
    persisted: 0,
    added: 0,
    updated: 0,
    ignored: 0,
    dryRun,
    dryRunAcceptedEvents: dryRun ? 3 : 0,
    read: 3,
    filtered: 0,
    duplicates: 0,
    missingCoordinates: 0,
    outOfBoundsCoordinates: 0,
    skipped: false,
    discovered: 3,
    matchedSources: 3,
    fallbackUsed: 0,
    fetchFailures: 0,
    sandboxRestricted: true,
    previewMock: true,
    filteredByReason: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, pastEvent: 0, duplicate: 0 },
    filteredSourceUrls: [],
    sourceReports: [{ sourceKey, read: 3, filtered: 0, persistable: dryRun ? 3 : 0, added: 0, updated: 0, ignored: 0, duplicates: 0, errors: [], durationMs, medianDurationMs: durationMs, p95DurationMs: durationMs, rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
  };
}

async function fetchWithConcurrency<T>(items: string[], worker: (item: string) => Promise<T>, concurrency: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try { results[index] = { status: "fulfilled", value: await worker(items[index]) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) }, runWorker));
  return results;
}

async function fetchPublicPage(url: string, options: { dryRun?: boolean } = {}): Promise<PublicPage> {
  if (isIngresseEventUrl(url)) return fetchIngresseEventApi(url, { read: getIngestionPayloadCache, write: saveIngestionPayloadCache }, options);
  if (isBlackPassEventUrl(url)) return fetchBlackPassEventPage(url);
  try {
    const requestInit: RequestInit = {
      headers: {
        "user-agent": "WeekendVibesBot/1.0 (+public-event-ingestion)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(isMrIngressosEventUrl(url) ? MR_INGRESSOS_FETCH_TIMEOUT_MS : publicFetchTimeoutMs(url)),
    };
    const response = isMrIngressosEventUrl(url)
      ? await fetchMrIngressosWithRetry(url, requestInit, (targetUrl: string | URL | Request, targetInit?: RequestInit) => fetchExternal(targetUrl instanceof Request ? targetUrl.url : String(targetUrl), targetInit ?? {}, MR_INGRESSOS_FETCH_TIMEOUT_MS))
      : await fetchExternal(url, requestInit, publicFetchTimeoutMs(url));
    const html = await readExternalBody(response);
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
    const hostname = new URL(url).hostname;
    const structured = hostname.endsWith("zig.tickets") ? parseZigEventMetadata(html, url) : (isBlackPassEventUrl(url) ? parseBlackPassEventMetadata(html, url) : isMrIngressosEventUrl(url) ? parseMrIngressosEventMetadata(html, url) : undefined);
    const normalizedText = structured?.text.slice(0, 8000) ?? text.slice(0, 8000);
    logPublicResponseDiagnostics({ url, status: response.status, contentType: response.headers.get("content-type"), html, text: normalizedText, structured: Boolean(structured), links: extractPublicEventLinks(html, url).length });
    const adapter = hostname.endsWith("blackpass.com.br") ? "blackpass" : hostname.endsWith("mringressos.com.br") ? "mringressos" : hostname.includes("ingresse") ? "ingresse" : "generic";
    const adapterError = (isBlackPassEventUrl(url) || isMrIngressosEventUrl(url)) && !structured ? `Adaptador ${adapter} não encontrou JSON-LD/metadados completos; conteúdo textual encaminhado para a classificação.` : undefined;
    return { url, html, text: normalizedText, imageUrl: structured?.imageUrl ?? imageMatch?.[1] ?? "", structured, adapter, adapterError };
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(sanitizeFetchFailure(error).message), { fetchFailure: sanitizeFetchFailure(error) });
  }
}

async function discoverCandidatePages(options: IngestionPipelineOptions = {}) {
  const configuredBases = getConfiguredSourceUrls();
  const bases = options.sourceKey
    ? configuredBases.filter(url => options.sourceKey === "public" || publicSourceKey(url) === options.sourceKey)
    : configuredBases;
  const discovered = new Set(bases);
  const basePages = await fetchWithConcurrency(bases, url => guardedFetchPublicPage(url, options), PUBLIC_FETCH_CONCURRENCY);
  for (let index = 0; index < basePages.length; index += 1) {
    const result = basePages[index];
    if (result.status !== "fulfilled") continue;
    const baseUrl = bases[index];
    for (const link of extractPublicEventLinks(result.value.html, result.value.url)) discovered.add(link);
    if (isMrIngressosCatalogUrl(baseUrl)) {
      for (const event of extractMrIngressosListingEvents(result.value.html, result.value.url)) discovered.add(event.url);
    }
    if (isBlackPassRootUrl(baseUrl)) {
      const catalog = await fetchBlackPassCatalog().catch(error => { logPublicFailureDiagnostics(baseUrl, error); return []; });
      if (catalog.length === 0) logPublicFailureDiagnostics(baseUrl, createFetchError("Adaptador Black Pass não encontrou eventos no catálogo público"));
      for (const event of catalog) if (event.id) discovered.add(blackPassEventUrl(event.id));
    }
  }
  return Array.from(discovered).filter(url => {
    try {
      const host = new URL(url).hostname;
      const belongsToSource = !options.sourceKey || options.sourceKey === "public" || publicSourceKey(url) === options.sourceKey;
      return belongsToSource && (!host.endsWith("zig.tickets") || url !== "https://zig.tickets/pt-BR");
    } catch { return false; }
  }).slice(0, 120);
}

export type IngestionSourceReport = {
  sourceKey: string;
  read: number;
  filtered: number;
  persistable: number;
  added: number;
  updated: number;
  ignored: number;
  duplicates: number;
  errors: Array<{ sourceUrl?: string; status: number | null; message: string }>;
  durationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  rejectionReasons: { fetchFailed: number; outsideTargetVenue: number; invalidStructuredEvent: number; duplicate: number; pastEvent: number };
};

export type IngestionPipelineOptions = { dryRun?: boolean; sourceKey?: string };
type PublicSourceReportInput = {
  candidateUrls: string[];
  pages: PromiseSettledResult<PublicPage>[];
  payloadEvents?: Array<Record<string, string | number>>;
  acceptedEvents?: Array<{ sourceKey: string }>;
  rejectedEvents?: Array<{ sourceKey: string; reason: "invalidStructuredEvent" | "pastEvent" }>;
  duplicateSourceKeys?: string[];
  sourceOutcomes?: Array<{ sourceKey: string; created: boolean; updated: boolean }>;
  matchesTargetVenue?: (value: string) => boolean;
};

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index];
}

function buildPublicSourceReports(input: PublicSourceReportInput): IngestionSourceReport[] {
  const reports = new Map<string, IngestionSourceReport & { latencySamples: number[] }>();
  const getReport = (sourceKey: string) => {
    const current = reports.get(sourceKey);
    if (current) return current;
    const created: IngestionSourceReport & { latencySamples: number[] } = {
      sourceKey,
      read: 0,
      filtered: 0,
      persistable: 0,
      added: 0,
      updated: 0,
      ignored: 0,
      duplicates: 0,
      errors: [],
      durationMs: 0,
      medianDurationMs: 0,
      p95DurationMs: 0,
      latencySamples: [],
      rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 },
    };
    reports.set(sourceKey, created);
    return created;
  };
  input.candidateUrls.forEach((url, index) => {
    const report = getReport(publicSourceKey(url));
    report.read += 1;
    const page = input.pages[index];
    if (!page || page.status === "rejected") {
      report.rejectionReasons.fetchFailed += 1;
      if (page?.status === "rejected") {
        const failure = sanitizeFetchFailure(page.reason);
        const durationMs = page.reason && typeof page.reason === "object" && "fetchDurationMs" in page.reason ? Number((page.reason as { fetchDurationMs?: unknown }).fetchDurationMs ?? 0) : 0;
        const safeDurationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
        report.durationMs += safeDurationMs;
        report.latencySamples.push(safeDurationMs);
        report.errors.push({ sourceUrl: url, status: failure.status, message: failure.message });
      }
      return;
    }
    const durationMs = Math.max(0, Number(page.value.durationMs ?? 0));
    report.durationMs += durationMs;
    report.latencySamples.push(durationMs);
    if (page.value.circuitOpen) {
      report.rejectionReasons.fetchFailed += 1;
      report.errors.push({ sourceUrl: url, status: null, message: "Fonte pausada pelo Circuit Breaker durante o cooldown." });
    } else if (input.matchesTargetVenue && !input.matchesTargetVenue(page.value.text)) {
      report.filtered += 1;
      report.rejectionReasons.outsideTargetVenue += 1;
    } else if (page.value.cacheFallback?.used) {
      report.errors.push({ sourceUrl: url, status: page.value.cacheFallback.status, message: `Fallback utilizado: ${page.value.cacheFallback.message}` });
    }
    if (page.value.adapterError) {
      report.errors.push({ sourceUrl: url, status: null, message: page.value.adapterError });
    }
  });
  for (const event of input.acceptedEvents ?? []) getReport(event.sourceKey).persistable += 1;
  for (const rejected of input.rejectedEvents ?? []) {
    const report = getReport(rejected.sourceKey);
    report.filtered += 1;
    report.rejectionReasons[rejected.reason] += 1;
  }
  for (const sourceKey of input.duplicateSourceKeys ?? []) {
    const report = getReport(sourceKey);
    report.duplicates += 1;
    report.ignored += 1;
    report.filtered += 1;
    report.rejectionReasons.duplicate += 1;
  }
  for (const outcome of input.sourceOutcomes ?? []) {
    const report = getReport(outcome.sourceKey);
    if (outcome.created) report.added += 1;
    else if (outcome.updated) report.updated += 1;
    else report.ignored += 1;
  }
  return Array.from(reports.values()).map(report => ({
    ...report,
    ignored: report.filtered,
    medianDurationMs: percentile(report.latencySamples, 50),
    p95DurationMs: percentile(report.latencySamples, 95),
    latencySamples: undefined,
  })).map(({ latencySamples: _latencySamples, ...report }) => report).sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
}

export async function runIngestionPipeline(options: IngestionPipelineOptions = {}) {
  const dryRun = options.dryRun === true;
  const activeAliases = await listActiveLocationAliasValues();
  const matchesTargetVenue = (value: string) => containsTargetVenue(value, activeAliases);
  const candidateUrls = await discoverCandidatePages(options);
  if (candidateUrls.length === 0) return { imported: 0, persisted: 0, dryRun, dryRunAcceptedEvents: 0, read: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, skipped: true, reason: "Nenhuma fonte de ingestão configurada", sourceReports: [] as IngestionSourceReport[] };
  const pages = await fetchWithConcurrency(candidateUrls, url => guardedFetchPublicPage(url, options), PUBLIC_FETCH_CONCURRENCY);
  const fulfilledPages = pages
    .filter((result): result is PromiseFulfilledResult<PublicPage> => result.status === "fulfilled")
    .map(result => result.value);
  const fallbackPages = fulfilledPages.filter(page => page.cacheFallback?.used);
  const circuitOpenPages = fulfilledPages.filter(page => page.circuitOpen === true);
  const rejectedPages = pages.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  const fetchFailures = [
    ...circuitOpenPages.map(page => ({ sourceUrl: page.url, status: null, message: "Fonte pausada pelo Circuit Breaker durante o cooldown.", fallbackUsed: false })),
    ...fallbackPages.map(page => ({ sourceUrl: page.url, ...page.cacheFallback, status: page.cacheFallback?.status ?? null })),
    ...rejectedPages.map((result, index) => ({ sourceUrl: candidateUrls[index], ...sanitizeFetchFailure(result.reason) })),
  ].map(failure => ({ sourceUrl: String(failure.sourceUrl).slice(0, 1000), status: failure.status ?? null, message: String(failure.message).slice(0, 240), fallbackUsed: "used" in failure && failure.used === true }));
  const fetchFailed = fetchFailures.length;
  const outsideTargetVenue = fulfilledPages.filter(page => !matchesTargetVenue(page.text)).length;
  const sourcePages = fulfilledPages.filter(page => matchesTargetVenue(page.text));
  const filteredByReason = { fetchFailed, outsideTargetVenue, invalidStructuredEvent: 0, pastEvent: 0, duplicate: 0 };
  const filteredSourceUrls = pages.flatMap((result, index) => result.status === "rejected" || !matchesTargetVenue(result.status === "fulfilled" ? result.value.text : "") ? [candidateUrls[index]] : []);

  if (sourcePages.length === 0) {
    const sandboxFailure = rejectedPages.some(result => isSandboxRestrictedError(result.reason));
    if (sandboxFailure && shouldUseSandboxMocks()) {
      return buildPreviewPublicMockResult(
        options.sourceKey ?? "public:preview",
        candidateUrls.length,
        Math.max(1, rejectedPages.reduce((sum, result) => sum + Number((result.reason as { fetchDurationMs?: unknown })?.fetchDurationMs ?? 1), 0)),
        dryRun
      );
    }
    return { imported: 0, persisted: 0, dryRun, dryRunAcceptedEvents: 0, read: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, skipped: false, discovered: candidateUrls.length, matchedSources: 0, fallbackUsed: fallbackPages.length, fetchFailures, filteredByReason, filteredSourceUrls, reason: "Nenhum evento dos locais-alvo encontrado nas fontes públicas", sourceReports: buildPublicSourceReports({ candidateUrls, pages, matchesTargetVenue }) };
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
      { role: "system", content: "Extraia somente eventos públicos de música, shows ou baladas nos locais oficiais Vallum Garden, Moby Dick, Ativa House, Casa 412, Verilonguinho, Meu Lugar, Goat Club, Laroc Club Guarujá, Lucky Scope, Curvão Surf House, Guarujá Golf Club, Praiô, Flamingos, Projac Bar, Boteco Almare, Dolores Restaurante e Bar ou Arena Jequitimar, localizados exclusivamente em Santos ou Guarujá. Ignore eventos passados, cidades diferentes, locais fora dessa allowlist e eventos de gastronomia, esporte, teatro ou exposição sem música. Retorne somente JSON no schema. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Se o gênero não puder ser inferido com segurança, descarte o evento. Use o SOURCE_URL correspondente como sourceUrl e IMAGE_URL quando houver." },
      { role: "user", content: rawText },
    ],
    response_format: { type: "json_schema", json_schema: { name: "event_batch", strict: true, schema: { type: "object", properties: { events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string" }, category: { type: "string", enum: ["show", "balada", "evento_musical"] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] }, priceCents: { type: "integer" }, sourceUrl: { type: "string" }, imageUrl: { type: "string" }, latitude: { type: "string" }, longitude: { type: "string" } }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "genre", "priceCents", "sourceUrl", "imageUrl", "latitude", "longitude"], additionalProperties: false } } }, required: ["events"], additionalProperties: false } } },
  });

  const payload = JSON.parse(String(structured.choices?.[0]?.message?.content ?? "{\"events\":[]}")) as { events: Array<Record<string, string | number>> };
  let imported = 0;
  let added = 0;
  let updated = 0;
  let duplicates = 0;
  const simulation = dryRun || verboseDryRunEnabled();
  let dryRunAcceptedEvents = 0;
  let missingCoordinates = 0;
  let outOfBoundsCoordinates = 0;
  const acceptedEvents: Array<{ title: string; eventDate: Date; city: string; sourceKey: string }> = [];
  const rejectedEvents: Array<{ sourceKey: string; reason: "invalidStructuredEvent" | "pastEvent" }> = [];
  const duplicateSourceKeys: string[] = [];
  const sourceOutcomes: Array<{ sourceKey: string; created: boolean; updated: boolean }> = [];
  for (const event of payload.events) {
    const date = new Date(String(event.eventDate));
    const locationName = String(event.locationName);
    const address = String(event.address);
    const city = normalizeVenueCity(locationName, address, String(event.city));
    const category = String(event.category);
    const genre = String(event.genre);
    const sourceKey = publicSourceKey(String(event.sourceUrl ?? ""));
    if (Number.isNaN(date.getTime()) || (city !== "Santos" && city !== "Guarujá") || !matchesTargetVenue(`${locationName} ${address}`) || !["show", "balada", "evento_musical"].includes(category) || !["funk", "house_eletronica", "samba_pagode", "rap_trap"].includes(genre)) {
      filteredByReason.invalidStructuredEvent += 1;
      rejectedEvents.push({ sourceKey, reason: "invalidStructuredEvent" });
      continue;
    }
    try { assertEventDateIsCurrentOrFuture(date, new Date(), String(event.title)); } catch { filteredByReason.pastEvent += 1; rejectedEvents.push({ sourceKey, reason: "pastEvent" }); continue; }
    const sourceUrl = String(event.sourceUrl);
    const fuzzyDuplicate = acceptedEvents.some(previous => areFuzzyDuplicateEvents(previous, { title: String(event.title), eventDate: date, city }));
    if (fuzzyDuplicate) { duplicates += 1; duplicateSourceKeys.push(sourceKey); continue; }
    acceptedEvents.push({ title: String(event.title), eventDate: date, city, sourceKey });
    const sourceHash = crypto.createHash("md5").update(`${normalizeSlug(String(event.sourceUrl))}:${normalizeSlug(String(event.title))}:${date.toISOString().slice(0, 10)}`).digest("hex");
    const sourceType = sourceUrl.includes("ingresse.com") ? "ingresse" : sourceUrl.includes("blackpass.com.br") ? "blackpass" : sourceUrl.includes("mringressos.com.br") ? "mringressos" : "public_source";
    const latitude = String(event.latitude || "");
    const longitude = String(event.longitude || "");
    if (!latitude || !longitude) missingCoordinates += 1;
    else {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!(lat >= -24.15 && lat <= -23.85 && lng >= -46.45 && lng <= -46.05)) outOfBoundsCoordinates += 1;
    }
    if (simulation) {
      dryRunAcceptedEvents += 1;
      continue;
    }
    const saved = await saveEvent({ title: String(event.title), slug: `${normalizeSlug(String(event.title))}-${date.getTime()}`, description: String(event.summary), eventDate: date, locationName: String(event.locationName), address: String(event.address), city, category: category as "show" | "balada" | "evento_musical", genre, priceCents: Number(event.priceCents) || 0, sourceUrl, sourceType, imageUrl: String(event.imageUrl || ""), latitude, longitude, sourceHash, isPublished: 1 });
    if (!saved || typeof saved !== "object") {
      added += 1;
      sourceOutcomes.push({ sourceKey, created: true, updated: false });
    } else if (saved.created) {
      added += 1;
      sourceOutcomes.push({ sourceKey, created: true, updated: false });
    } else if (saved.updated) {
      updated += 1;
      sourceOutcomes.push({ sourceKey, created: false, updated: true });
    } else {
      duplicates += 1;
      duplicateSourceKeys.push(sourceKey);
      sourceOutcomes.push({ sourceKey, created: false, updated: false });
    }
    imported += 1;
  }
  const sourceReports = buildPublicSourceReports({ candidateUrls, pages, payloadEvents: payload.events, acceptedEvents, rejectedEvents, duplicateSourceKeys, sourceOutcomes, matchesTargetVenue });
  const persistedCount = simulation ? 0 : added + updated;
  const contentFiltered = filteredByReason.invalidStructuredEvent + filteredByReason.pastEvent;
  const read = simulation ? 0 : persistedCount + contentFiltered + duplicates;
  const ignored = contentFiltered + duplicates;
  return { imported, persisted: persistedCount, added: simulation ? 0 : added, updated: simulation ? 0 : updated, ignored, dryRun: simulation, dryRunAcceptedEvents, read, filtered: contentFiltered, duplicates, missingCoordinates, outOfBoundsCoordinates, skipped: false, discovered: candidateUrls.length, matchedSources: sourcePages.length, fallbackUsed: fallbackPages.length, fetchFailures, filteredByReason, filteredSourceUrls, sourceReports };
}
