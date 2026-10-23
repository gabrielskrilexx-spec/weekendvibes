import crypto from "node:crypto";
import { load } from "cheerio";
import { invokeLLM } from "./_core/llm";
import { assertEventDateIsCurrentOrFuture, getIngestionPayloadCache, listActiveLocationAliasValues, listIngestionSources, recordOperationalAlert, saveEvent, saveIngestionPayloadCache } from "./db";
import { allowSourceAttempt, registerSourceFailure, registerSourceSuccess } from "./circuit-breaker";
import { fetchExternal, isSandboxRestrictedError, readExternalBody, sanitizeExternalFetchError } from "./external-fetch";
import { parsePayloadJsonColumn } from "./json-contracts";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings";

const DEFAULT_SOURCE_URLS = [
  "https://articket.com.br/e/6784/plants-happy-hour",
  "https://articket.com.br/e/7160/o-encontro",
  "https://articket.com.br/",
  "https://blacktag.com.br/",
  "https://www.ingresse.com/reveillon-guaruja-2027/",
  "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/",
  "https://www.ingresse.com/nosso-after-mc-luuky/",
  "https://www.ingresse.com/nosso-after-14-08/",
  "https://www.ingresse.com/",
  "https://blackpass.com.br/",
  "https://mringressos.com.br/",
  "https://www.sympla.com.br/eventos/santos-sp",
  "https://www.sympla.com.br/eventos/guaruja-sp",
  "https://www.weticket.com.br/",
  "https://weticket.com.br/ap-22-edio-helloween-pedro-qua",
  "https://zig.tickets/pt-BR",
  "http://www.turismosantos.com.br/pt-br/tags/parque-valongo",
  "https://articket.com.br/o/58/eventos-litoral",
  "https://santosconventioncenter.com.br/agenda-2026/",
];

const normalizeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const stripHtml = (value: string) => {
  const $ = load(value, undefined, false);
  $("script, style, noscript").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
};
const INGRESSE_SITE_API = "https://api-site.ingresse.com/events";
export const DEFAULT_INGRESSE_FETCH_TIMEOUT_MS = 15_000;
export function getIngresseFetchTimeoutMs() {
  const configured = Number.parseInt(process.env.INGRESSE_FETCH_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_INGRESSE_FETCH_TIMEOUT_MS;
  return Math.min(20_000, Math.max(3_000, configured));
}

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
export function isWafBlockedFailure(status: number | null | undefined, message: string) {
  const normalized = message.toLowerCase();
  return (status === 403 || status === 503) && (status === 403 || /cloudflare|akamai|waf|anti.?bot|challenge|forbidden|access denied|blocked/i.test(normalized));
}
function formatPublicFetchFailure(failure: FetchFailure) {
  return isWafBlockedFailure(failure.status, failure.message)
    ? `Bloqueado por WAF (HTTP ${failure.status}): ${failure.message}`
    : failure.message;
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
    if (focusUrls.length > 0) return Array.from(new Set(focusUrls.map(sanitizePublicSourceUrl)));
  }
  const configured = process.env.INGESTION_SOURCE_URL ?? process.env.INGESTION_SOURCE_URLS;
  if (configured !== undefined) {
    let configuredUrls: string[];
    try {
      const parsed = JSON.parse(configured);
      configuredUrls = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").map(sanitizePublicSourceUrl).filter(Boolean) : [];
    } catch {
      configuredUrls = configured.split(",").map(sanitizePublicSourceUrl).filter(Boolean);
    }
    if (configuredUrls.length === 0) return [];
    return Array.from(new Set([...configuredUrls, ...DEFAULT_SOURCE_URLS]));
  }
  return DEFAULT_SOURCE_URLS;
}

export function filterDisabledPublicSourceUrls(urls: string[], disabledSourceKeys: ReadonlySet<string>) {
  return urls.filter(url => !disabledSourceKeys.has(publicSourceKey(url)));
}

async function getEnabledConfiguredSourceUrls() {
  const configuredUrls = getConfiguredSourceUrls();
  try {
    const sources = await listIngestionSources();
    const enabledDatabaseUrls = sources
      .filter(source => source.kind === "public" && source.isEnabled === 1)
      .map(source => sanitizePublicSourceUrl(source.url))
      .filter(Boolean);
    const allConfiguredUrls = Array.from(new Set([...configuredUrls, ...enabledDatabaseUrls]));
    const disabledSourceKeys = new Set(
      sources.filter(source => source.kind === "public" && source.isEnabled !== 1).map(source => source.sourceKey),
    );
    return filterDisabledPublicSourceUrls(allConfiguredUrls, disabledSourceKeys);
  } catch (error) {
    console.warn("[Ingestion] Failed to read source enablement; preserving configured URLs", sanitizeFetchFailure(error));
    return configuredUrls;
  }
}

export function containsTargetVenue(value: string, aliases: string[] = []) {
  const normalized = normalizeText(value);
  return aliases.some(venue => normalized.includes(normalizeText(venue)));
}

export function sanitizePublicSourceUrl(input: string) {
  try {
    const parsed = new URL(input.trim());
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return input.trim();
  }
}

const TRACKED_PUBLIC_BRANDS = [
  { brand: "APÊ 22", sourceKey: "public:weticket", pattern: /ap(?:ê|e)\s*22/i },
  { brand: "OSUCO", sourceKey: "public:zig", pattern: /osuco/i },
] as const;

export function getTrackedPublicBrand(value: string, sourceKey?: string) {
  const candidate = String(value ?? "");
  return TRACKED_PUBLIC_BRANDS.find(item => (!sourceKey || item.sourceKey === sourceKey) && item.pattern.test(candidate))?.brand;
}

export function matchesTrackedPublicBrand(value: string, sourceKey?: string) {
  return Boolean(getTrackedPublicBrand(value, sourceKey));
}

export function buildPublicEventIdentity(sourceKey: string, title: string, eventDate: Date | string, sourceUrl: string) {
  const day = new Date(eventDate).toISOString().slice(0, 10);
  const brand = getTrackedPublicBrand(`${title} ${sourceUrl}`, sourceKey);
  const articketId = sourceKey === "public:articket" ? sanitizePublicSourceUrl(sourceUrl).match(/\/e\/(\d+)(?:\/|$)/i)?.[1] : undefined;
  const identity = articketId ? `${sourceKey}|${articketId}|${day}` : brand ? `${sourceKey}|${brand}|${day}` : `${normalizeSlug(sourceUrl)}|${normalizeSlug(title)}|${day}`;
  return crypto.createHash("md5").update(identity).digest("hex");
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
  if ((/vallum|valluns/.test(venue) && /garden/.test(venue)) || /santos convention center|blue med convention center|mendes convention center/.test(venue)) return "Santos";
  return city;
}

export function extractPublicEventLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const absoluteBase = new URL(baseUrl);
  const $ = load(html, undefined, false);
  $("a[href]").each((_, anchor) => {
    try {
      const href = $(anchor).attr("href");
      if (!href) return;
      const url = new URL(href, absoluteBase);
      if (url.origin !== absoluteBase.origin) return;
      const isArticket = url.pathname.startsWith("/e/") && url.hostname.includes("articket");
      const isBlacktag = url.pathname.startsWith("/eventos/") && url.hostname.includes("blacktag");
      const isZig = url.pathname.startsWith("/eventos/") && (url.hostname === "zig.tickets" || url.hostname.endsWith(".zig.tickets"));
      const isIngresseEvent = url.hostname.includes("ingresse") && url.pathname !== "/" && !url.pathname.startsWith("/search");
      const isBlackPass = url.hostname.endsWith("blackpass.com.br") && /^\/event\/[A-Za-z0-9_-]+/.test(url.pathname);
      const isMrIngressos = url.hostname.endsWith("mringressos.com.br") && /^\/comprar\/[A-Za-z0-9_-]+/.test(url.pathname);
      const isSympla = url.hostname.endsWith("sympla.com.br") && /^\/evento\/[A-Za-z0-9-]+\/[0-9]+/.test(url.pathname);
      const isWeTicket = url.hostname.endsWith("weticket.com.br") && /^\/[A-Za-z0-9][A-Za-z0-9-]+$/.test(url.pathname) && !["/perguntas-frequentes", "/politica-de-privacidade", "/termos-de-uso"].includes(url.pathname.toLowerCase());
      const anchorText = $(anchor).text().replace(/\s+/g, " ").trim();
      const isZigRegional = !isZig || /santos|guaruj[aá]/i.test(normalizeText(anchorText));
      if ((isArticket || isBlacktag || isZig || isIngresseEvent || isBlackPass || isMrIngressos || isSympla || isWeTicket) && isZigRegional) links.add(url.href);
    } catch {
      // Ignore malformed public links.
    }
  });
  const collectEmbeddedPath = (value: string) => {
    try {
      const path = value.match(/(?:^|["'\\])((?:\/event\/[A-Za-z0-9_-]+)|(?:\/comprar\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?))(?:["'\\]|$)/)?.[1];
      if (path) {
        const url = new URL(path, absoluteBase);
        if (url.origin === absoluteBase.origin && (url.pathname.startsWith("/event/") || url.pathname.startsWith("/comprar/"))) links.add(url.href);
      }
      for (const match of Array.from(value.matchAll(/(?:https:\/\/www\.sympla\.com\.br)?(\/evento\/[A-Za-z0-9-]+\/[0-9]+)/g))) {
        const url = new URL(match[1], "https://www.sympla.com.br");
        if (url.origin === absoluteBase.origin) links.add(url.href);
      }
    } catch { /* ignore malformed embedded paths */ }
  };
  $("[href], [url], [link], [data-href], [data-url], [data-link]").each((_, element) => {
    for (const attribute of ["href", "url", "link", "data-href", "data-url", "data-link"] as const) {
      const value = $(element).attr(attribute);
      if (value) collectEmbeddedPath(value);
    }
  });
  $("script").each((_, script) => collectEmbeddedPath($(script).html() ?? ""));
  return Array.from(links).slice(0, 60);
}

function readJsonLd(html: string) {
  const $ = load(html, undefined, false);
  let found: Record<string, unknown> | undefined;
  $("script[type='application/ld+json'], script[type='application/json']").each((_, script) => {
    if (found) return false;
    try {
      const parsed = JSON.parse($(script).contents().text().trim()) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const event = values.find(value => {
        if (!value || typeof value !== "object") return false;
        const record = value as Record<string, unknown>;
        return String(record["@type"] ?? "").toLowerCase() === "event" || "startDate" in record;
      });
      if (event && typeof event === "object") found = event as Record<string, unknown>;
    } catch {
      // Ignore malformed structured data and continue with metadata fallbacks.
    }
    return undefined;
  });
  return found;
}

function readMetaTags(html: string) {
  const $ = load(html, undefined, false);
  const values = new Map<string, string>();
  $("meta").each((_, element) => {
    const key = String($(element).attr("property") ?? $(element).attr("name") ?? "").toLowerCase();
    const content = $(element).attr("content");
    if (key && content !== undefined && !values.has(key)) values.set(key, content);
  });
  return (key: string) => values.get(key.toLowerCase()) ?? "";
}

export const ZIG_FETCH_TIMEOUT_MS = 20_000;
const ZIG_REQUEST_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "sec-ch-ua": '"Chromium";v="140", "Google Chrome";v="140", "Not=A?Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "upgrade-insecure-requests": "1",
};

function readPriceCents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const normalized = String(value).replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function parsePortugueseEventDate(value: string) {
  const months: Record<string, string> = { janeiro: "01", fevereiro: "02", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };
  const match = value.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})(?:\s+às\s+(\d{1,2}):(\d{2}))?/i);
  if (!match) return "";
  const month = months[normalizeText(match[2])];
  if (!month) return "";
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}T${(match[4] ?? "20").padStart(2, "0")}:${match[5] ?? "00"}:00-03:00`;
}

export function parseZigEventMetadata(html: string, url: string) {
  let jsonLd: Record<string, unknown> | undefined;
  try {
    jsonLd = readJsonLd(html);
  } catch {
    jsonLd = undefined;
  }
  const location = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  const offers = Array.isArray(jsonLd?.offers) ? (jsonLd.offers.find(item => item && typeof item === "object") as Record<string, unknown> | undefined) ?? {} : jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : {};
  const meta = readMetaTags(html);
  const text = stripHtml(html);
  const sourceText = text.replace(/\s+/g, " ").trim();
  const title = typeof jsonLd?.name === "string" ? jsonLd.name.trim() : meta("og:title").trim() || html.match(/^#\s+([^\n]+)$/m)?.[1]?.trim() || sourceText.slice(0, 160);
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate : meta("event:start_time") || parsePortugueseEventDate(sourceText.match(/Quando:\s*([^\n|]+)/i)?.[1] ?? sourceText);
  const locationName = typeof location.name === "string" && location.name.trim()
    ? location.name.trim()
    : typeof jsonLd?.location === "string" && jsonLd.location.trim()
      ? jsonLd.location.trim()
      : /curv[aã]o\s+surf\s+house/i.test(`${title} ${sourceText} ${url}`)
        ? "Curvão Surf House"
        : /praia\s+verde/i.test(`${title} ${sourceText} ${url}`)
          ? "Praia Verde Beach Club"
      : /osuco/i.test(`${title} ${text} ${url}`)
        ? "Osuco"
        : "";
  const city = typeof address.addressLocality === "string" ? address.addressLocality.trim() : (/guaruj[aá]/i.test(sourceText) ? "Guarujá" : /santos/i.test(sourceText) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : sourceText.match(/Endereço:\s*([^|]+)/i)?.[1]?.trim() ?? "";
  const priceCents = readPriceCents(offers.price ?? offers.lowPrice ?? offers.minPrice) || readPriceCents(sourceText.match(/R\$\s*[\d.,]+/i)?.[0] ?? "");
  const imageUrl = meta("og:image");
  const searchable = normalizeText(`${title} ${String(jsonLd?.description ?? "")} ${sourceText} ${locationName}`);
  const genre = /funk/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : /house|eletronic|eletrônica|dj|balada|festa|m[uú]sica|music|sunset/.test(searchable) ? "house_eletronica" : "";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : /balada|festa|dj|boate|reveillon|sunset|open\s+bar/.test(searchable) ? "balada" : genre ? "evento_musical" : "";
  if (!title || !eventDate || !city) return undefined;
  return { title, summary: sourceText.slice(0, 4_000), eventDate, locationName, address: street, city, category, genre, priceCents, sourceUrl: url, imageUrl, latitude: "", longitude: "", text: sourceText.slice(0, 16_000) };
}

function extractTicket360Field(html: string, field: string) {
  const normalized = html.replace(/\\+"/g, '"');
  const eventIndex = normalized.search(/"ev"\s*:\s*\{/i);
  const scoped = eventIndex >= 0 ? normalized.slice(eventIndex, eventIndex + 8_000) : normalized;
  const match = scoped.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, "i"))?.[1];
  if (!match) return "";
  try { return JSON.parse(`"${match.replace(/\\+u0026/g, "&")}"`) as string; } catch { return match.replace(/\\+u0026/g, "&").replace(/\\+"/g, '"'); }
}

export function parseTicket360EventMetadata(html: string, url: string) {
  const meta = readMetaTags(html);
  const $ = load(html, undefined, false);
  const title = extractTicket360Field(html, "title") || $("h1").first().text().replace(/\s+/g, " ").trim() || meta("og:title").replace(/^.*?·\s*/i, "").trim();
  const venue = extractTicket360Field(html, "venue");
  const visibleText = stripHtml(html).replace(/\s+/g, " ").trim();
  const city = extractTicket360Field(html, "city") || (/guaruj[aá]/i.test(visibleText) ? "Guarujá" : "");
  const date = extractTicket360Field(html, "date");
  const doorsTime = extractTicket360Field(html, "doorsTime") || "20h00";
  const timeMatch = doorsTime.match(/(\d{1,2})(?:h|:)(\d{2})?/i);
  const eventDate = date && timeMatch ? `${date}T${timeMatch[1].padStart(2, "0")}:${(timeMatch[2] ?? "00").padStart(2, "0")}:00-03:00` : date;
  const imageUrl = extractTicket360Field(html, "image") || meta("og:image");
  const address = `${venue}${city ? `, ${city}` : ""}`;
  const searchable = normalizeText(`${title} ${venue} ${visibleText}`);
  const genre = /funk/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : "house_eletronica";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : "balada";
  if (!title || !eventDate || !venue || !city) return undefined;
  return { title, summary: visibleText.slice(0, 4_000), eventDate, locationName: venue, address, city, category, genre, priceCents: 0, sourceUrl: url, imageUrl, latitude: "", longitude: "", text: visibleText.slice(0, 16_000) };
}

export const PARQUE_VALONGO_FETCH_TIMEOUT_MS = 20_000;
export const EVENTOS_LITORAL_FETCH_TIMEOUT_MS = 20_000;
export const BLUE_MED_FETCH_TIMEOUT_MS = 20_000;
const SANTOS_PUBLIC_REQUEST_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "upgrade-insecure-requests": "1",
};

function isParqueValongoUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("turismosantos.com.br") && parsed.pathname.includes("parque-valongo");
  } catch { return false; }
}

function isEventosLitoralOrganizerUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("articket.com.br") && /^\/o\/(?:58|621)(?:\/|$)/.test(parsed.pathname);
  } catch { return false; }
}

function isBlueMedAgendaUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("santosconventioncenter.com.br") && /\/agenda(?:-2026)?\/?$/.test(parsed.pathname);
  } catch { return false; }
}

function parseBlueMedDate(value: string) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00-03:00`;
}

export function parseBlueMedAgendaEvents(html: string, url: string) {
  const $ = load(html, undefined, false);
  const events: Array<Record<string, string | number>> = [];
  $(".card-evento").each((_index, element) => {
    const card = $(element);
    const title = card.find(".titulo-evento").first().text().replace(/\s+/g, " ").trim();
    const dateText = card.find(".data-evento").first().text().replace(/\s+/g, " ").trim();
    const eventDate = parseBlueMedDate(dateText);
    const imageUrl = card.find("img").first().attr("src") ?? "";
    const ticketUrl = card.find(".botao-evento a").first().attr("href") ?? url;
    const searchable = normalizeText(title);
    const genre = /pagod|samba/.test(searchable) ? "samba_pagode" : /funk/.test(searchable) ? "funk" : /rap|trap/.test(searchable) ? "rap_trap" : "";
    const category = genre ? "evento_musical" : "";
    if (!title || !eventDate || !genre || /^evento fechado$/i.test(title)) return;
    events.push({ title, summary: `${title} no Santos Convention Center.`, eventDate, locationName: "Santos Convention Center", address: "Praça Almirante Gago Coutinho, 29, Ponta da Praia", city: "Santos", category, genre, priceCents: 0, sourceUrl: ticketUrl, imageUrl, latitude: "", longitude: "", text: `${title} ${dateText} Santos Convention Center Santos` });
  });
  return events;
}

export function parseParqueValongoEventMetadata(html: string, url: string) {
  const jsonLd = readJsonLd(html);
  const location = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  const meta = readMetaTags(html);
  const $ = load(html, undefined, false);
  $("script, style, noscript").remove();
  const visibleText = $.root().text().replace(/\s+/g, " ").trim();
  const title = typeof jsonLd?.name === "string" ? jsonLd.name.trim() : "";
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate.trim() : "";
  const locationName = typeof location.name === "string" && location.name.trim() ? location.name.trim() : "Parque Valongo";
  const city = typeof address.addressLocality === "string" && address.addressLocality.trim() ? address.addressLocality.trim() : /santos/i.test(visibleText) ? "Santos" : "";
  const addressLine = typeof address.streetAddress === "string" ? address.streetAddress : "Rua Antônio Prado, s/nº, Centro Histórico";
  const searchable = normalizeText(`${title} ${visibleText}`);
  const genre = /funk/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : /show|m[uú]sica|festival|dj|concerto/.test(searchable) ? "house_eletronica" : "";
  const category = /show|festival|concerto|m[uú]sica|dj/.test(searchable) ? "evento_musical" : "";
  if (title && eventDate && city === "Santos" && genre && category) {
    return { title, summary: visibleText.slice(0, 4_000), eventDate, locationName, address: addressLine, city, category, genre, priceCents: 0, sourceUrl: url, imageUrl: meta("og:image"), text: visibleText.slice(0, 16_000) };
  }

  // Algumas páginas do Turismo Santos exibem o evento apenas em HTML. O
  // fallback exige um título, uma data ISO/HTML5 e texto verificável de
  // Santos/Parque Valongo; sem esses campos, continua descartando o item.
  const candidate = $("article, .evento, .event, [data-event], main").filter((_index, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    return /parque valongo|arcos do valongo/i.test(text) && Boolean(element);
  }).first();
  if (!candidate.length) return undefined;
  const candidateText = candidate.text().replace(/\s+/g, " ").trim();
  const fallbackTitle = candidate.find("h1, h2, h3, .titulo, .title, [data-title]").first().text().replace(/\s+/g, " ").trim();
  const fallbackDate = candidate.find("time[datetime], [datetime], [data-start-date], [data-date]").first().attr("datetime")
    ?? candidate.find("[data-start-date], [data-date]").first().attr("data-start-date")
    ?? candidate.find("[data-date]").first().attr("data-date")
    ?? "";
  const fallbackSearchable = normalizeText(`${fallbackTitle} ${candidateText}`);
  const fallbackGenre = /funk/.test(fallbackSearchable) ? "funk" : /samba|pagode/.test(fallbackSearchable) ? "samba_pagode" : /rap|trap/.test(fallbackSearchable) ? "rap_trap" : /show|m[uú]sica|festival|dj|concerto/.test(fallbackSearchable) ? "house_eletronica" : "";
  const fallbackCategory = /show|festival|concerto|m[uú]sica|dj/.test(fallbackSearchable) ? "evento_musical" : "";
  if (!fallbackTitle || !fallbackDate || !/^\d{4}-\d{2}-\d{2}T/.test(fallbackDate) || !/santos|parque valongo|arcos do valongo/i.test(candidateText) || !fallbackGenre || !fallbackCategory) return undefined;
  return { title: fallbackTitle, summary: candidateText.slice(0, 4_000), eventDate: fallbackDate, locationName: /arcos do valongo/i.test(candidateText) ? "Arcos do Valongo" : "Parque Valongo", address: "Rua Antônio Prado, s/nº, Centro Histórico", city: "Santos", category: fallbackCategory, genre: fallbackGenre, priceCents: 0, sourceUrl: url, imageUrl: meta("og:image"), text: candidateText.slice(0, 16_000) };
}

export function parseEventosLitoralOrganizerMetadata(html: string, url: string) {
  const meta = readMetaTags(html);
  const $ = load(html, undefined, false);
  $("script, style, noscript").remove();
  const text = $.root().text().replace(/\s+/g, " ").trim();
  if (!/eventos litoral/i.test(text) || !text) return undefined;
  return { sourceUrl: url, imageUrl: meta("og:image"), text: text.slice(0, 16_000) };
}

function isBlackPassEventUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("blackpass.com.br") && /^\/event\//.test(parsed.pathname); } catch { return false; }
}

function isBlackPassRootUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("blackpass.com.br") && ["", "/", "/events"].includes(parsed.pathname.replace(/\/$/, "")); } catch { return false; }
}

function isSymplaEventUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("sympla.com.br") && /^\/evento\/[A-Za-z0-9-]+\/[0-9]+/.test(parsed.pathname);
  } catch { return false; }
}

function isArticketEventUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("articket.com.br") && /^\/e\/[A-Za-z0-9_-]+/.test(parsed.pathname); } catch { return false; }
}

export const WETICKET_FETCH_TIMEOUT_MS = 20_000;
const WETICKET_REQUEST_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
  "sec-ch-ua": '"Chromium";v="140", "Google Chrome";v="140", "Not=A?Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "upgrade-insecure-requests": "1",
};

function isWeTicketEventUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("weticket.com.br") && /^\/[A-Za-z0-9][A-Za-z0-9-]+$/.test(parsed.pathname) && !["/perguntas-frequentes", "/politica-de-privacidade", "/termos-de-uso"].includes(parsed.pathname.toLowerCase());
  } catch { return false; }
}

function parseWeTicketDate(value: string) {
  const months: Record<string, string> = { janeiro: "01", fevereiro: "02", marco: "03", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };
  const match = value.toLowerCase().match(/\b(\d{1,2})\s+de\s+([a-záéç]+)\s+de\s+(\d{4})(?:,?\s+às?\s+(\d{1,2})(?::|h)(\d{2})?)?/i);
  if (!match) return "";
  const month = months[normalizeText(match[2])];
  if (!month) return "";
  const hour = String(Number(match[4] ?? "0")).padStart(2, "0");
  const minute = String(Number(match[5] ?? "0")).padStart(2, "0");
  return `${match[3]}-${month}-${String(Number(match[1])).padStart(2, "0")}T${hour}:${minute}:00-03:00`;
}

export function parseWeTicketEventMetadata(html: string, url: string) {
  const jsonLd = readJsonLd(html);
  const location = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  const meta = readMetaTags(html);
  const $ = load(html, undefined, false);
  $("script, style, noscript").remove();
  const visibleText = $.root().text().replace(/\s+/g, " ").trim();
  const title = String(jsonLd?.name || meta("og:title") || $("h1").first().text() || $("title").first().text() || "").replace(/\s+/g, " ").trim();
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate : parseWeTicketDate(visibleText);
  const locationName = typeof location.name === "string" ? location.name.trim() : (visibleText.match(/(?:O\s+Beco|Casa\s+412|GOAT\s+CLUB|Boteco\s+Almare|Vallum\s+Garden)[^,|]{0,80}/i)?.[0] ?? "").trim();
  const city = typeof address.addressLocality === "string" ? address.addressLocality : (/guaruj[aá]/i.test(visibleText) ? "Guarujá" : /santos/i.test(visibleText) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : "";
  const priceMatch = visibleText.match(/r\$\s*([\d.]+(?:,\d{2})?)/i);
  const priceCents = priceMatch ? Math.round(Number(priceMatch[1].replace(/\./g, "").replace(",", ".")) * 100) : 0;
  const searchable = normalizeText(`${title} ${visibleText}`);
  const genre = /funk/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : "house_eletronica";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : "balada";
  if (!title || !eventDate || !locationName || !city) return undefined;
  return { title, summary: visibleText.slice(0, 4_000), eventDate, locationName, address: street, city, category, genre, priceCents, sourceUrl: url, imageUrl: meta("og:image"), text: visibleText.slice(0, 16_000) };
}

type SymplaEventState = {
  name?: unknown;
  newUrl?: unknown;
  logoUrl?: unknown;
  detail?: unknown;
  strippedDetail?: unknown;
  startDateMultiFormat?: { ISO8601?: unknown };
  startDate?: unknown;
  eventsAddress?: { name?: unknown; address?: unknown; addressNum?: unknown; neighborhood?: unknown; city?: unknown; state?: unknown; geolocation?: { latitude?: unknown; longitude?: unknown } };
};

function readSymplaEventState(html: string): SymplaEventState | undefined {
  const $ = load(html, undefined, false);
  const raw = $("script#__NEXT_DATA__").contents().text().trim();
  if (!raw) return undefined;
  try {
    const root = JSON.parse(raw) as { props?: { pageProps?: { hydrationData?: { eventHydration?: { event?: unknown } } } } };
    const event = root.props?.pageProps?.hydrationData?.eventHydration?.event;
    return event && typeof event === "object" ? event as SymplaEventState : undefined;
  } catch {
    return undefined;
  }
}

export function parseSymplaEventMetadata(html: string, url: string) {
  const state = readSymplaEventState(html);
  const meta = readMetaTags(html);
  const $ = load(html, undefined, false);
  $("script, style, noscript").remove();
  const visibleText = $.root().text().replace(/\s+/g, " ").trim();
  const address = state?.eventsAddress ?? {};
  const title = String(state?.name ?? meta("og:title") ?? "").trim();
  const eventDate = String(state?.startDateMultiFormat?.ISO8601 ?? state?.startDate ?? meta("event:start_time") ?? "").trim();
  const locationName = String(address.name ?? "").trim();
  const city = String(address.city ?? "").trim();
  const addressLine = [address.address, address.addressNum, address.neighborhood, city, address.state].filter(value => typeof value === "string" && value.trim()).join(", ");
  const detail = typeof state?.strippedDetail === "string" ? state.strippedDetail : typeof state?.detail === "string" ? stripHtml(state.detail) : meta("og:description");
  const coordinates = address.geolocation ?? {};
  const searchable = normalizeText(`${title} ${detail} ${locationName}`);
  const genre = /\bfunk\b/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : /house|eletronic|dj|balada|festa/.test(searchable) ? "house_eletronica" : "";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : /balada|festa|dj|boate/.test(searchable) ? "balada" : genre ? "evento_musical" : "";
  const priceMatch = `${visibleText} ${detail}`.match(/r\$\s*([\d.]+(?:,\d{2})?)/i);
  const priceCents = priceMatch ? Math.round(Number(priceMatch[1].replace(/\./g, "").replace(",", ".")) * 100) : 0;
  if (!title || !eventDate || !city || !locationName) return undefined;
  return {
    title,
    summary: String(detail ?? "").slice(0, 4_000),
    eventDate,
    locationName,
    address: addressLine,
    city,
    category,
    genre,
    priceCents,
    sourceUrl: url,
    imageUrl: String(state?.logoUrl ?? meta("og:image") ?? ""),
    latitude: String(coordinates.latitude ?? ""),
    longitude: String(coordinates.longitude ?? ""),
    text: [title, detail, locationName, addressLine, city].filter(Boolean).join(" ").slice(0, 16_000),
  };
}

const BLACKPASS_EVENTS_API = "https://api.blackpass.com.br/events/list";
export const BLACKPASS_FETCH_TIMEOUT_MS = 20_000;
const BLACKPASS_REQUEST_HEADERS = {
  accept: "application/json,text/html,application/xhtml+xml",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
  "sec-ch-ua": '"Chromium";v="140", "Google Chrome";v="140", "Not=A?Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
};

async function fetchPublicAdapterJson<T>(input: string, init: RequestInit = {}, timeoutMs = 12_000, attempts = 2, externalSignal?: AbortSignal): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchExternal(input, init, timeoutMs, false, externalSignal);
      if (!response.ok) throw createFetchError(`Fonte pública respondeu ${response.status}`, response.status);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      const failure = sanitizeFetchFailure(error);
      if (failure.status !== null || !isTimeoutFailure(error) || attempt === attempts - 1) {
        console.warn("[Public adapter] request failed", { url: input, status: failure.status, message: failure.message });
        throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure });
      }
      await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha na fonte pública");
}

type BlackPassCatalogEvent = { id?: string | number; title?: string; name?: string; address?: string; address_comp?: string; city?: string; uf?: string; latlng?: string; price?: string | number; min_price?: string | number; lowest_price?: string | number; dates?: Array<{ dstart?: string; dstop?: string; status?: number | string }>; poster?: { poster_vertical?: string; poster_horizontal?: string } };

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
  const dateTime = event.dates?.find(item => Number(item.status ?? 1) !== 0)?.dstart ?? event.dates?.[0]?.dstart ?? "";
  const [latitude, longitude] = String(event.latlng ?? "").split(",").map(value => value.trim());
  const imagePath = event.poster?.poster_vertical || event.poster?.poster_horizontal || "";
  const imageUrl = imagePath.startsWith("http") ? imagePath : imagePath ? `https://api.blackpass.com.br${imagePath}` : "";
  const rawPrice = event.price ?? event.min_price ?? event.lowest_price;
  const priceCents = typeof rawPrice === "number" ? Math.round(rawPrice * 100) : typeof rawPrice === "string" && rawPrice.trim() ? Math.round(Number(rawPrice.replace(/[^0-9,.-]/g, "").replace(",", ".")) * 100) : 0;
  if (!event.id || !title || !dateTime || !locationName) return undefined;
  const sourceUrl = blackPassEventUrl(event.id);
  return { title, summary: title, eventDate: dateTime, locationName, address, city, category: "balada", genre: "house_eletronica", priceCents, sourceUrl, imageUrl, latitude: latitude ?? "", longitude: longitude ?? "", text: [title, locationName, address, city, dateTime].filter(Boolean).join(" ") };
}

function parseBlackPassCatalogPayload(payload: unknown): BlackPassCatalogEvent[] {
  const candidates = Array.isArray(payload) ? payload : payload && typeof payload === "object" ? ((payload as { data?: unknown; events?: unknown; results?: unknown }).data ?? (payload as { events?: unknown }).events ?? (payload as { results?: unknown }).results) : [];
  if (!Array.isArray(candidates)) throw createFetchError("Adaptador Black Pass recebeu contrato de catálogo inesperado");
  return candidates.filter((item): item is BlackPassCatalogEvent => Boolean(item && typeof item === "object"));
}

let blackPassCatalogCache: Promise<BlackPassCatalogEvent[]> | undefined;
async function fetchBlackPassCatalog(): Promise<BlackPassCatalogEvent[]> {
  blackPassCatalogCache ??= fetchPublicAdapterJson<unknown>(BLACKPASS_EVENTS_API, { headers: BLACKPASS_REQUEST_HEADERS }, BLACKPASS_FETCH_TIMEOUT_MS).then(parseBlackPassCatalogPayload);
  try {
    return await blackPassCatalogCache;
  } catch (error) {
    blackPassCatalogCache = undefined;
    throw error;
  }
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
  const $ = load(html, undefined, false);
  $("a[href]").each((_, anchor) => {
    try {
      const href = $(anchor).attr("href");
      if (!href || !/\/comprar\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?/.test(href)) return;
      const url = new URL(href, baseUrl).href;
      const text = $(anchor).text().replace(/\s+/g, " ").trim();
      const heading = $(anchor).find("h1, h2, h3, h4, h5, h6").first().text();
      const title = stripHtml(heading ?? "") || text.match(/(?:\d{1,2}h\d{2})\s+(.+?)(?=\s+(?:Dolores|Boteco|Projac|Tardezinha|Amsterdã|Asipavic|Campo|Quintalzinho|Sede Vicente|G\.R\.C\.E\.S\.)\b|\s+-\s+(?:Guarujá|Guaruja|Santos))/i)?.[1]?.trim() || text.slice(0, 160);
      if (title && !events.some(event => event.url === url)) events.push({ url, title: title.slice(0, 160), text: text.slice(0, 1000) });
    } catch { /* ignore malformed listing links */ }
  });
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
  const offers = Array.isArray(jsonLd?.offers)
    ? jsonLd.offers.filter((offer): offer is Record<string, unknown> => Boolean(offer && typeof offer === "object"))[0] ?? {}
    : jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : {};
  const meta = readMetaTags(html);
  const $ = load(html, undefined, false);
  $("script, style, noscript").remove();
  const visibleText = $.root().text().replace(/\s+/g, " ").trim();
  const h1Text = $("h1").first().text();
  const pageTitle = $("title").first().text();
  const title = typeof jsonLd?.name === "string" ? jsonLd.name : meta("og:title") || stripHtml(h1Text) || stripHtml(pageTitle);
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate : (meta("event:start_time") || visibleText.match(/(?:sex|sab|dom|seg|ter|qua|qui)[^0-9]{0,20}(\d{1,2})[\/ .-]+([a-záéêç]+|\d{1,2})[^0-9]{0,12}(\d{1,2})h?(\d{2})?/i)?.[0] || "");
  const locationName = typeof location.name === "string" ? location.name : (visibleText.match(/(?:Guarujá|Guaruja|Santos)[^,|]{0,80}/i)?.[0] ?? "").trim();
  const rawCity = typeof address.addressLocality === "string" ? address.addressLocality : (/guaruj[aá]/i.test(visibleText) ? "Guarujá" : /santos/i.test(visibleText) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : "";
  const city = normalizeVenueCity(String(locationName), `${street} ${visibleText}`, rawCity);
  const priceRaw = typeof offers.price === "number" || typeof offers.price === "string" ? String(offers.price) : "";
  const priceCents = priceRaw ? Math.round(Number(priceRaw.replace(/[^0-9,.-]/g, "").replace(",", ".")) * 100) : 0;
  const offerNote = [offers.name, offers.description].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" — ").trim();
  const lotNote = visibleText.match(/(?:\d{1,2}[º°o]?|primeiro|segundo|terceiro)\s*lote[^.;|]{0,120}/i)?.[0]?.trim() ?? "";
  const priceNote = (offerNote || lotNote || undefined)?.slice(0, 255);
  if (!title && !eventDate && !locationName) return undefined;
  return { title, eventDate, locationName, address: street, city, priceCents, priceNote, sourceUrl: url, imageUrl: meta("og:image"), text: visibleText.slice(0, 16_000) };
}

export function parseArticketEventMetadata(html: string, url: string) {
  const parsed = parseTicketingEventMetadata(html, url);
  if (!parsed) return undefined;
  if (!parsed.title.trim() || !parsed.eventDate.trim() || !parsed.locationName.trim() || !parsed.city.trim()) return undefined;
  const searchable = normalizeText(`${parsed.title} ${parsed.text} ${parsed.locationName}`);
  const genre = /funk/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : /show|festival|m[uú]sica|dj|festa|balada|sertanejo|arrocha|pagode/.test(searchable) ? "house_eletronica" : "";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : genre ? "evento_musical" : "";
  return { ...parsed, summary: parsed.text.slice(0, 4_000), category, genre };
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

export function isIngresseCatalogRootUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("ingresse.com") && ["", "/"].includes(parsed.pathname);
  } catch {
    return false;
  }
}

function getIngresseSlug(url: string) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? "");
}

export async function fetchIngresseEventApi(url: string, cacheStore: IngresseCacheStore = { read: getIngestionPayloadCache, write: saveIngestionPayloadCache }, options: { dryRun?: boolean; signal?: AbortSignal } = {}) {
  const slug = getIngresseSlug(url);
  if (!slug) throw createFetchError(`URL Ingresse sem slug de evento: ${url}`);
  try {
    const payload = await fetchPublicAdapterJson<Record<string, unknown>>(`${INGRESSE_SITE_API}/${encodeURIComponent(slug)}`, {
      headers: {
        accept: "application/json",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "sec-ch-ua": '"Chromium";v="140", "Google Chrome";v="140", "Not=A?Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        referer: `https://www.ingresse.com/${encodeURIComponent(slug)}/`,
        "upgrade-insecure-requests": "1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      },
    }, getIngresseFetchTimeoutMs(), 2, options.signal);
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
    const purchaseUrl = typeof payload.externalLink === "string" && /^https:\/\//i.test(payload.externalLink) ? payload.externalLink : url;
    const text = [title, description, placeName, address, city, dateTime].filter(Boolean).join(" ");
    if (!title || !dateTime || !placeName) throw createFetchError(`API pública do Ingresse sem dados essenciais para ${url}`);
    const structured = { title, summary: description, eventDate: dateTime, locationName: placeName, address, city, category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: purchaseUrl, imageUrl, latitude, longitude };
    if (!options.dryRun) await cacheStore.write({ cacheKey: ingresseCacheKey(url), sourceKey: "public:ingresse", sourceUrl: url, payload: structured, latitude, longitude }).catch(error => console.warn("[Ingestion cache] Could not save Ingresse payload:", sanitizeFetchFailure(error).message));
    return { url, html: "", text: text.slice(0, 16_000), imageUrl, structured };
  } catch (error) {
    const failure = sanitizeFetchFailure(error);
    // Um 403 indica bloqueio explícito do provedor; não reutilizamos cache potencialmente obsoleto.
    if (failure.status === 403) throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure });
    const cached = await cacheStore.read(ingresseCacheKey(url)).catch(() => undefined);
    if (cached) {
      try {
        const structured = parsePayloadJsonColumn(cached.payload) as Record<string, string | number>;
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
  adapter?: "blackpass" | "mringressos" | "ingresse" | "sympla" | "weticket" | "ticket360" | "zig" | "articket" | "parque-valongo" | "eventos-litoral" | "blue-med" | "generic";
  adapterError?: string;
  durationMs?: number;
  structured?: Record<string, string | number | undefined> | Array<Record<string, string | number | undefined>>;
  cacheFallback?: { used: true; status: number | null; message: string };
  fetchFailure?: FetchFailure;
  circuitOpen?: boolean;
};

export function publicSourceKey(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (isParqueValongoUrl(url)) return "public:parque-valongo";
    if (isEventosLitoralOrganizerUrl(url)) return "public:eventos-litoral";
    if (isBlueMedAgendaUrl(url)) return "public:blue-med";
    if (host.includes("ingresse")) return "public:ingresse";
    if (host.includes("blacktag")) return "public:blacktag";
    if (host.includes("blackpass")) return "public:blackpass";
    if (host.includes("mringressos")) return "public:mringressos";
    if (host.includes("sympla.com.br")) return "public:sympla";
    if (host.includes("weticket.com.br")) return "public:weticket";
    if (host.includes("ticket360.com.br")) return "public:ticket360";
    if (host.includes("articket")) return "public:articket";
    if (host.endsWith("zig.tickets")) return "public:zig";
  } catch {
    // Keep malformed URLs under the generic public source.
  }
  return "public:unknown";
}

async function guardedFetchPublicPage(url: string, options: { dryRun?: boolean; signal?: AbortSignal } = {}): Promise<PublicPage> {
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
    if (!options.dryRun) {
      try {
        await registerSourceFailure({ sourceKey, routine: "public-agenda", status: failure.status ?? undefined, message: failure.message });
      } catch (registrationError) {
        console.warn("[Ingestion] Could not persist isolated public source failure:", sanitizeFetchFailure(registrationError).message);
      }
    }
    throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure, fetchDurationMs: Math.max(0, Date.now() - startedAt) });
  }
}

const PUBLIC_FETCH_TIMEOUT_MS = 12_000;
export const ARTICKET_FETCH_TIMEOUT_MS = 30_000;
export const SYMPLA_FETCH_TIMEOUT_MS = 20_000;
function publicFetchTimeoutMs(url: string) {
  const sourceKey = publicSourceKey(url);
  if (sourceKey === "public:articket") return ARTICKET_FETCH_TIMEOUT_MS;
  if (sourceKey === "public:ingresse") return getIngresseFetchTimeoutMs();
  if (sourceKey === "public:sympla") return SYMPLA_FETCH_TIMEOUT_MS;
  if (sourceKey === "public:ticket360") return SYMPLA_FETCH_TIMEOUT_MS;
  if (sourceKey === "public:zig") return ZIG_FETCH_TIMEOUT_MS;
  if (sourceKey === "public:parque-valongo") return PARQUE_VALONGO_FETCH_TIMEOUT_MS;
  if (sourceKey === "public:eventos-litoral") return EVENTOS_LITORAL_FETCH_TIMEOUT_MS;
  if (sourceKey === "public:blue-med") return BLUE_MED_FETCH_TIMEOUT_MS;
  return PUBLIC_FETCH_TIMEOUT_MS;
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
      const message = error instanceof Error ? error.message : String(error ?? "");
      const isTransientNetworkFailure = /fetch failed|econnreset|econnrefused|enotfound|eai_again|network|socket/i.test(message);
      if ((!isTimeoutFailure(error) && !isTransientNetworkFailure) || attempt === MR_INGRESSOS_RETRY_ATTEMPTS - 1) throw error;
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

export async function fetchWithConcurrency<TItem, TResult>(items: TItem[], worker: (item: TItem) => Promise<TResult>, concurrency: number): Promise<PromiseSettledResult<TResult>[]> {
  const results: PromiseSettledResult<TResult>[] = new Array(items.length);
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

async function fetchPublicPage(url: string, options: { dryRun?: boolean; signal?: AbortSignal } = {}): Promise<PublicPage> {
  if (isIngresseEventUrl(url)) return fetchIngresseEventApi(url, { read: getIngestionPayloadCache, write: saveIngestionPayloadCache }, options);
  if (isBlackPassEventUrl(url)) return fetchBlackPassEventPage(url);
  if (isWeTicketEventUrl(url)) {
    const response = await fetchExternal(url, { headers: WETICKET_REQUEST_HEADERS }, WETICKET_FETCH_TIMEOUT_MS, false, options.signal);
    const html = await readExternalBody(response);
    const structured = parseWeTicketEventMetadata(html, url);
    const meta = readMetaTags(html);
    const text = structured?.text ?? meta("og:description") ?? "";
    if (!text) throw createFetchError("WeTicket retornou conteúdo vazio");
    return { url, html, text: text.slice(0, 16_000), imageUrl: structured?.imageUrl ?? meta("og:image"), structured, adapter: "weticket", adapterError: structured ? undefined : "Adaptador WeTicket não encontrou dados estruturados completos." };
  }
  if (isSymplaEventUrl(url)) {
    const response = await fetchExternal(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", accept: "text/html,application/xhtml+xml", "accept-language": "pt-BR,pt;q=0.9,en;q=0.8", "cache-control": "no-cache", "sec-ch-ua": '"Chromium";v="140", "Google Chrome";v="140", "Not=A?Brand";v="24"', "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"', "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "sec-fetch-site": "same-origin", "upgrade-insecure-requests": "1" } }, SYMPLA_FETCH_TIMEOUT_MS, false, options.signal);
    const html = await readExternalBody(response);
    const structured = parseSymplaEventMetadata(html, url);
    const meta = readMetaTags(html);
    const $ = load(html, undefined, false);
    $("script, style, noscript").remove();
    const text = structured?.text ?? $.root().text().replace(/\s+/g, " ").trim();
    if (!text) throw createFetchError("Sympla retornou conteúdo vazio");
    return { url, html, text: text.slice(0, 16_000), imageUrl: structured?.imageUrl ?? meta("og:image"), structured, adapter: "sympla", adapterError: structured ? undefined : "Adaptador Sympla não encontrou dados estruturados públicos." };
  }
  if (new URL(url).hostname.endsWith("zig.tickets")) {
    const response = await fetchExternal(url, { headers: { ...ZIG_REQUEST_HEADERS, accept: "text/markdown,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", referer: "https://zig.tickets/pt-BR" } }, ZIG_FETCH_TIMEOUT_MS, false, options.signal);
    const html = await readExternalBody(response);
    const structured = parseZigEventMetadata(html, url);
    const meta = readMetaTags(html);
    const text = structured?.text ?? meta("og:description") ?? "";
    if (!text) throw createFetchError("Zig Tickets retornou conteúdo vazio");
    return { url, html, text: text.slice(0, 16_000), imageUrl: structured?.imageUrl ?? meta("og:image"), structured, adapter: "zig", adapterError: structured ? undefined : "Adaptador Zig não encontrou metadados públicos completos." };
  }
  if (new URL(url).hostname.endsWith("ticket360.com.br")) {
    const response = await fetchExternal(url, { headers: SANTOS_PUBLIC_REQUEST_HEADERS }, SYMPLA_FETCH_TIMEOUT_MS, false, options.signal);
    const html = await readExternalBody(response);
    const structured = parseTicket360EventMetadata(html, url);
    const meta = readMetaTags(html);
    const text = structured?.text ?? stripHtml(html);
    if (!text) throw createFetchError("Ticket360 retornou conteúdo vazio");
    return { url, html, text: text.slice(0, 16_000), imageUrl: structured?.imageUrl ?? meta("og:image"), structured, adapter: "ticket360", adapterError: structured ? undefined : "Adaptador Ticket360 não encontrou dados estruturados públicos." };
  }
  if (isParqueValongoUrl(url)) {
    const response = await fetchExternal(url, { headers: SANTOS_PUBLIC_REQUEST_HEADERS }, PARQUE_VALONGO_FETCH_TIMEOUT_MS, false, options.signal);
    const html = await readExternalBody(response);
    const meta = readMetaTags(html);
    const structured = parseParqueValongoEventMetadata(html, url);
    const $ = load(html, undefined, false);
    $("script, style, noscript").remove();
    const text = structured?.text ?? $.root().text().replace(/\s+/g, " ").trim();
    if (!text) throw createFetchError("Página pública do Parque Valongo retornou conteúdo vazio");
    return { url, html, text: text.slice(0, 16_000), imageUrl: structured?.imageUrl ?? meta("og:image"), structured, adapter: "parque-valongo", adapterError: structured ? undefined : "Página do Parque Valongo sem evento JSON-LD completo; conteúdo encaminhado para classificação." };
  }
  if (isEventosLitoralOrganizerUrl(url)) {
    const response = await fetchExternal(url, { headers: SANTOS_PUBLIC_REQUEST_HEADERS }, EVENTOS_LITORAL_FETCH_TIMEOUT_MS, false, options.signal);
    const html = await readExternalBody(response);
    const metadata = parseEventosLitoralOrganizerMetadata(html, url);
    if (!metadata) throw createFetchError("Página pública do Eventos Litoral retornou conteúdo vazio ou contrato inesperado");
    return { url, html, text: metadata.text, imageUrl: metadata.imageUrl, adapter: "eventos-litoral" };
  }
  if (isBlueMedAgendaUrl(url)) {
    const response = await fetchExternal(url, { headers: { ...SANTOS_PUBLIC_REQUEST_HEADERS, referer: "https://santosconventioncenter.com.br/" } }, BLUE_MED_FETCH_TIMEOUT_MS, false, options.signal);
    const html = await readExternalBody(response);
    const structured = parseBlueMedAgendaEvents(html, url);
    const $ = load(html, undefined, false);
    $("script, style, noscript").remove();
    const text = $.root().text().replace(/\s+/g, " ").trim();
    if (!text) throw createFetchError("Agenda do Blue Med retornou conteúdo vazio");
    return { url, html, text: text.slice(0, 16_000), imageUrl: "", structured, adapter: "blue-med", adapterError: structured.length ? undefined : "Agenda do Blue Med sem eventos musicais elegíveis." };
  }
  try {
    const requestInit: RequestInit = {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
      },
      signal: AbortSignal.timeout(isMrIngressosEventUrl(url) ? MR_INGRESSOS_FETCH_TIMEOUT_MS : publicFetchTimeoutMs(url)),
    };
    const response = isMrIngressosEventUrl(url)
      ? await fetchMrIngressosWithRetry(url, requestInit, (targetUrl: string | URL | Request, targetInit?: RequestInit) => fetchExternal(targetUrl instanceof Request ? targetUrl.url : String(targetUrl), targetInit ?? {}, MR_INGRESSOS_FETCH_TIMEOUT_MS))
      : await fetchExternal(url, requestInit, publicFetchTimeoutMs(url));
    const html = await readExternalBody(response);
    const meta = readMetaTags(html);
    const $ = load(html, undefined, false);
    $("script, style, noscript").remove();
    const text = $.root().text().replace(/\s+/g, " ").trim();
    if (!text) throw createFetchError("Fonte pública retornou conteúdo vazio");
    const hostname = new URL(url).hostname;
    const structured = hostname.endsWith("zig.tickets") ? parseZigEventMetadata(html, url) : (isBlackPassEventUrl(url) ? parseBlackPassEventMetadata(html, url) : isMrIngressosEventUrl(url) ? parseMrIngressosEventMetadata(html, url) : isArticketEventUrl(url) ? parseArticketEventMetadata(html, url) : undefined);
    const structuredText = Array.isArray(structured) ? structured.map(item => String(item.text ?? "")).join(" ") : structured?.text;
    const normalizedText = structuredText?.slice(0, 8000) ?? text.slice(0, 8000);
    logPublicResponseDiagnostics({ url, status: response.status, contentType: response.headers.get("content-type"), html, text: normalizedText, structured: Boolean(structured), links: extractPublicEventLinks(html, url).length });
    const adapter = hostname.endsWith("blackpass.com.br") ? "blackpass" : hostname.endsWith("mringressos.com.br") ? "mringressos" : hostname.includes("ingresse") ? "ingresse" : hostname.includes("sympla.com.br") ? "sympla" : hostname.includes("weticket.com.br") ? "weticket" : hostname.includes("ticket360.com.br") ? "ticket360" : hostname.endsWith("zig.tickets") ? "zig" : hostname.endsWith("articket.com.br") ? "articket" : "generic";
    const adapterError = (isBlackPassEventUrl(url) || isMrIngressosEventUrl(url)) && !structured ? `Adaptador ${adapter} não encontrou JSON-LD/metadados completos; conteúdo textual encaminhado para a classificação.` : undefined;
    return { url, html, text: normalizedText, imageUrl: structured?.imageUrl ?? meta("og:image"), structured, adapter, adapterError };
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(sanitizeFetchFailure(error).message), { fetchFailure: sanitizeFetchFailure(error) });
  }
}

async function discoverCandidatePages(options: IngestionPipelineOptions = {}) {
  const configuredBases = await getEnabledConfiguredSourceUrls();
  const bases = options.sourceKey
    ? configuredBases.filter(url => options.sourceKey === "public" || publicSourceKey(url) === options.sourceKey)
    : configuredBases;
  const crawlBases = bases.filter(url => !isIngresseCatalogRootUrl(url));
  const discovered = new Set(crawlBases);
  const basePages = await fetchWithConcurrency(crawlBases, url => guardedFetchPublicPage(url, options), PUBLIC_FETCH_CONCURRENCY);
  for (let index = 0; index < basePages.length; index += 1) {
    const result = basePages[index];
    if (result.status !== "fulfilled") continue;
    const baseUrl = crawlBases[index];
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

export type IngestionPipelineOptions = { dryRun?: boolean; sourceKey?: string; signal?: AbortSignal };
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
        report.errors.push({ sourceUrl: url, status: failure.status, message: formatPublicFetchFailure(failure) });
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
  const matchesTargetContent = (value: string) => matchesTargetVenue(value) || matchesTrackedPublicBrand(value, options.sourceKey);
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
  ].map(failure => ({ sourceUrl: String(failure.sourceUrl).slice(0, 1000), status: failure.status ?? null, message: formatPublicFetchFailure({ status: failure.status ?? null, message: String(failure.message).slice(0, 240) }), fallbackUsed: "used" in failure && failure.used === true }));
  const fetchFailed = fetchFailures.length;
  const outsideTargetVenue = fulfilledPages.filter(page => !matchesTargetContent(page.text)).length;
  const sourcePages = fulfilledPages.filter(page => matchesTargetContent(page.text));
  const filteredByReason = { fetchFailed, outsideTargetVenue, invalidStructuredEvent: 0, pastEvent: 0, duplicate: 0 };
  const filteredSourceUrls = pages.flatMap((result, index) => result.status === "rejected" || !matchesTargetContent(result.status === "fulfilled" ? result.value.text : "") ? [candidateUrls[index]] : []);

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

  const apiStructuredEvents = sourcePages.flatMap(page => {
    if (!("structured" in page) || !page.structured) return [];
    return Array.isArray(page.structured) ? page.structured : [page.structured];
  });
  const rawText = sourcePages
    .map(page => `SOURCE_URL: ${page.url}\nIMAGE_URL: ${page.imageUrl}\nCONTENT: ${page.text}`)
    .join("\n\n")
    .slice(0, 48_000);

  const structured = apiStructuredEvents.length > 0 ? { choices: [{ message: { content: JSON.stringify({ events: apiStructuredEvents }) } }] } : await invokeLLM({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Extraia somente eventos públicos de música, shows ou baladas nos locais oficiais Vallum Garden, Moby Dick, Ativa House, Casa 412, Verilonguinho, Meu Lugar, Goat Club, Laroc Club Guarujá, Lucky Scope, Curvão Surf House, Guarujá Golf Club, Praia Verde Beach Club, Praia Verde, Casa Grande Hotel Resort, Casa Grande Hotel, Praiô, Flamingos, Projac Bar, Boteco Almare, Dolores Restaurante e Bar, Arena Jequitimar, Parque Valongo, Armazém 3, Blue Med Convention Center ou Santos Convention Center, localizados exclusivamente em Santos ou Guarujá. Ignore eventos passados, cidades diferentes, locais fora dessa allowlist e eventos de gastronomia, esporte, teatro ou exposição sem música. Retorne somente JSON no schema. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Se o gênero não puder ser inferido com segurança, descarte o evento. Use o SOURCE_URL correspondente como sourceUrl e IMAGE_URL quando houver." },
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
    const sourceHash = buildPublicEventIdentity(sourceKey, String(event.title), date, sourceUrl);
    const sourceType = sourceUrl.includes("ingresse.com") ? "ingresse" : sourceUrl.includes("blackpass.com.br") ? "blackpass" : sourceUrl.includes("mringressos.com.br") ? "mringressos" : sourceUrl.includes("sympla.com.br") ? "sympla" : sourceUrl.includes("weticket.com.br") ? "weticket" : sourceUrl.includes("zig.tickets") ? "zig" : sourceUrl.includes("articket.com.br") ? "articket" : "public_source";
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
    const saved = await saveEvent({ title: String(event.title), slug: `${normalizeSlug(String(event.title))}-${date.getTime()}`, description: String(event.summary), eventDate: date, locationName: String(event.locationName), address: String(event.address), city, category: category as "show" | "balada" | "evento_musical", genre, priceCents: Number(event.priceCents) || 0, priceNote: event.priceNote === undefined ? undefined : String(event.priceNote).slice(0, 255), sourceUrl, sourceType, imageUrl: String(event.imageUrl || ""), latitude, longitude, sourceHash, isPublished: 1 });
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
    if (saved && typeof saved === "object" && saved.created) {
      const brand = getTrackedPublicBrand(String(event.title), sourceKey);
      if (brand) {
        const editionDate = date.toISOString().slice(0, 10);
        await recordOperationalAlert({
          integration: "public",
          alertType: "brand_new_edition",
          severity: "INFO",
          title: `Nova edição ${brand} detectada`,
          message: `${brand} nova edição em ${editionDate}`,
        }).catch(error => console.warn("[Brand monitoring] Failed to record discovery alert", error));
      }
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
