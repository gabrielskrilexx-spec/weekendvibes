import crypto from "node:crypto";
import { load } from "cheerio";
import { invokeLLM } from "./_core/llm";
import { assertEventDateIsCurrentOrFuture, formatArticketSourceName, getIngestionPayloadCache, listActiveLocationAliasValues, listActiveMonitoredBrands, listIngestionSources, recordOperationalAlert, saveEvent, saveIngestionPayloadCache, updateDiscoveredArticketSourceName, upsertDiscoveredArticketSource } from "./db";
import { allowSourceAttempt, registerSourceFailure, registerSourceSuccess } from "./circuit-breaker";
import { fetchExternal, isSandboxRestrictedError, readExternalBody, sanitizeExternalFetchError } from "./external-fetch";
import { parsePayloadJsonColumn } from "./json-contracts";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings";
import type { MonitoredBrand } from "../drizzle/schema";
import { sanitizeEventText } from "../shared/event-text";

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
  "https://gandaya.dance/",
  "https://weticket.com.br/ap-22-edio-helloween-pedro-qua",
  "https://zig.tickets/pt-BR",
  "https://www.turismosantos.com.br/pt-br/tags/parque-valongo",
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
const ZIG_PUBLIC_API_BASE = "https://m.zig.tickets/api/public/v1";
const ZIG_PUBLIC_SITE_BASE = "https://zig.tickets";
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


export type FetchFailure = {
  sourceKey?: string;
  url?: string;
  status: number | null;
  httpStatus?: number | null;
  message: string;
  errorCode?: "UPSTREAM_UNAVAILABLE" | "TIMEOUT" | "NETWORK_ERROR" | "PARSE_EMPTY" | "HTTP_ERROR" | "UNKNOWN";
  retryable?: boolean;
  attempts?: number;
};
type IngresseCacheStore = {
  read: typeof getIngestionPayloadCache;
  write: typeof saveIngestionPayloadCache;
};

function getHttpStatus(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number") return Number((error as { statusCode: number }).statusCode);
  const match = String(error instanceof Error ? error.message : error).match(/\b(?:HTTP|status|respondeu)\s*(\d{3})\b/i);
  return match ? Number(match[1]) : null;
}

export function sanitizeFetchFailure(error: unknown, context: { sourceKey?: string; url?: string } = {}): FetchFailure {
  const status = getHttpStatus(error);
  const raw = error instanceof Error ? error.message : String(error ?? "Falha desconhecida");
  const message = raw.replace(/https?:\/\/[^\s]+/gi, "fonte pública").replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 240);
  const candidate = error && typeof error === "object" ? error as { code?: unknown; attempts?: unknown; retryable?: unknown } : {};
  const code = String(candidate.code ?? "");
  const errorCode: FetchFailure["errorCode"] = status === 502 || status === 503 || status === 504
    ? "UPSTREAM_UNAVAILABLE"
    : code === "TIMEOUT" || /timeout|timed out|tempo limite|aborted/i.test(raw)
      ? "TIMEOUT"
      : code === "NETWORK_ERROR" || /fetch failed|econn|enotfound|eai_again|network|socket/i.test(raw)
        ? "NETWORK_ERROR"
        : /conteúdo vazio|sem dados|sem dados estruturados|JSON inválido/i.test(raw)
          ? "PARSE_EMPTY"
          : status !== null ? "HTTP_ERROR" : "UNKNOWN";
  const retryable = typeof candidate.retryable === "boolean" ? candidate.retryable : errorCode === "UPSTREAM_UNAVAILABLE" || errorCode === "TIMEOUT" || errorCode === "NETWORK_ERROR";
  const attempts = typeof candidate.attempts === "number" && Number.isFinite(candidate.attempts) ? Math.max(1, Math.trunc(candidate.attempts)) : 1;
  return { sourceKey: context.sourceKey, url: context.url, status, httpStatus: status, message: message || "Falha de coleta da fonte pública", errorCode, retryable, attempts };
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

export function filterExplicitPublicSourceUrls(urls: string[], requestedUrls?: string[]) {
  if (requestedUrls === undefined) return urls;
  const requested = new Set(requestedUrls.map(sanitizePublicSourceUrl));
  return urls.filter(url => requested.has(sanitizePublicSourceUrl(url)));
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

const LEGACY_TRACKED_PUBLIC_BRANDS = [
  { brand: "APÊ 22", sourceKey: "public:weticket", pattern: /ap(?:ê|e)\s*22/i },
  { brand: "OSUCO", sourceKey: "public:zig", pattern: /osuco/i },
] as const;

type MonitoredBrandRule = Pick<MonitoredBrand, "slug" | "name" | "cities" | "platforms" | "matchTerms">;

const PUBLIC_PLATFORM_BY_SOURCE: Record<string, string> = {
  "public:ingresse": "ingresse",
  "public:sympla": "sympla",
  "public:articket": "articket",
  "public:eventos-litoral": "articket",
  "public:zig": "zig",
  "public:weticket": "weticket",
  "public:ticket360": "ticket360",
  "public:blacktag": "blacktag",
  "public:blackpass": "blackpass",
  "public:mringressos": "mringressos",
  "public:gandaya": "gandaya",
};

const GANDAYA_API_BASE = "https://api.gandaya.dance";
export const GANDAYA_FETCH_TIMEOUT_MS = 20_000;
export const GANDAYA_REGIONAL_CITIES = ["Santos", "Guarujá", "São Vicente", "Praia Grande", "Cubatão"] as const;

function normalizeRegionalCity(value: string) {
  const normalized = normalizeText(value);
  return GANDAYA_REGIONAL_CITIES.find(city => normalizeText(city) === normalized) ?? "";
}

export function isGandayaRegionalCandidate(candidate: { city?: string; location?: string; address?: string; text?: string }) {
  const searchable = normalizeText(`${candidate.city ?? ""} ${candidate.location ?? ""} ${candidate.address ?? ""} ${candidate.text ?? ""}`);
  return GANDAYA_REGIONAL_CITIES.some(city => searchable.includes(normalizeText(city)));
}

export function filterGandayaRegionalCandidates<T extends { city?: string; location?: string; address?: string; text?: string }>(candidates: T[]) {
  const regional: T[] = [];
  const filtered: T[] = [];
  for (const candidate of candidates) (isGandayaRegionalCandidate(candidate) ? regional : filtered).push(candidate);
  return { regional, filtered };
}

function monitoredBrandSupportsSource(brand: MonitoredBrandRule, sourceKey?: string) {
  if (!sourceKey) return true;
  const platform = PUBLIC_PLATFORM_BY_SOURCE[sourceKey];
  return brand.platforms.some(configured => {
    const normalized = normalizeSlug(configured);
    if (normalized === "bilheterias-itinerantes") return sourceKey.startsWith("public:");
    if (normalized === "instagram") return sourceKey.startsWith("instagram:");
    return Boolean(platform && normalized === normalizeSlug(platform));
  });
}

export function getMonitoredPublicBrand(value: string, sourceKey?: string, brands: MonitoredBrandRule[] = []) {
  const candidate = String(value ?? "");
  const normalizedCandidate = normalizeSlug(candidate);
  return brands.find(brand =>
    monitoredBrandSupportsSource(brand, sourceKey) &&
    brand.matchTerms.some(term => {
      const normalizedTerm = normalizeSlug(term);
      return normalizedTerm.length >= 3 && normalizedCandidate.includes(normalizedTerm);
    })
  );
}

export function getTrackedPublicBrand(value: string, sourceKey?: string, brands: MonitoredBrandRule[] = []) {
  const candidate = String(value ?? "");
  const monitored = getMonitoredPublicBrand(candidate, sourceKey, brands);
  if (monitored) return monitored.name;
  return LEGACY_TRACKED_PUBLIC_BRANDS.find(item => (!sourceKey || item.sourceKey === sourceKey) && item.pattern.test(candidate))?.brand;
}

export function matchesTrackedPublicBrand(value: string, sourceKey?: string, brands: MonitoredBrandRule[] = []) {
  return Boolean(getTrackedPublicBrand(value, sourceKey, brands));
}

/** A monitored brand is a valid target even when the event location is itinerant. */
export function matchesPublicTarget(value: string, sourceKey: string | undefined, aliases: string[], brands: MonitoredBrandRule[] = []) {
  return containsTargetVenue(value, aliases) || matchesTrackedPublicBrand(value, sourceKey, brands);
}

export function buildPublicEventIdentity(sourceKey: string, title: string, eventDate: Date | string, sourceUrl: string, brands: MonitoredBrandRule[] = []) {
  const day = new Date(eventDate).toISOString().slice(0, 10);
  const brand = getTrackedPublicBrand(`${title} ${sourceUrl}`, sourceKey, brands);
  const articketId = sourceKey === "public:articket" ? sanitizePublicSourceUrl(sourceUrl).match(/\/e\/(\d+)(?:\/|$)/i)?.[1] : undefined;
  const identity = brand ? `${sourceKey}|${brand}|${day}` : articketId ? `${sourceKey}|${articketId}|${day}` : `${normalizeSlug(sourceUrl)}|${normalizeSlug(title)}|${day}`;
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
  if (/lucky\s*scope/.test(venue)) return "Guarujá";
  if ((/vallum|valluns/.test(venue) && /garden/.test(venue)) || /verilonguinho|santos convention center|blue med convention center|mendes convention center/.test(venue)) return "Santos";
  return city;
}

function isSupportedPublicEventUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  return (host.includes("articket") && /^\/e\/\d+(?:\/|$)/i.test(url.pathname))
    || (host.includes("blacktag") && /^\/(?:evento|eventos|event|events)\//i.test(url.pathname))
    || ((host === "zig.tickets" || host.endsWith(".zig.tickets")) && /^\/eventos?\//i.test(url.pathname))
    || isIngresseEventUrl(url.href)
    || (host.endsWith("blackpass.com.br") && /^\/event\//i.test(url.pathname))
    || (host.endsWith("mringressos.com.br") && /^\/comprar\//i.test(url.pathname))
    || (host.endsWith("sympla.com.br") && (/^\/evento\/[^/]+/i.test(url.pathname) || /^\/eventos\/[^/]+\/[^/]+/i.test(url.pathname)))
    || (host.endsWith("weticket.com.br") && /^\/[A-Za-z0-9][A-Za-z0-9-]+$/.test(url.pathname))
    || (host.endsWith("ticket360.com.br") && /^\/(?:evento|eventos)\//i.test(url.pathname))
    || host.endsWith("gandaya.dance") && /^\/(?:event|evento|events)\//i.test(url.pathname);
}

export function extractSitemapUrls(xml: string, baseUrl = "https://example.com/") {
  const links = new Set<string>();
  for (const match of Array.from(xml.matchAll(/<loc[^>]*>\s*([^<]+?)\s*<\/loc>/gi))) {
    try {
      const url = new URL(match[1].trim(), baseUrl);
      if (isSupportedPublicEventUrl(url)) links.add(sanitizePublicSourceUrl(url.href));
    } catch { /* ignore malformed sitemap entries */ }
  }
  return Array.from(links);
}

export function extractEmbeddedPublicEventUrls(payload: string, baseUrl: string) {
  const links = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value) && !value.startsWith("/")) return;
    try {
      const url = new URL(value, baseUrl);
      if (isSupportedPublicEventUrl(url)) links.add(sanitizePublicSourceUrl(url.href));
    } catch { /* ignore malformed embedded URL */ }
  };
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 8 || value === null || value === undefined) return;
    if (typeof value === "string") { add(value); return; }
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (/^(?:url|@id|href|link|eventUrl|sourceUrl|permalink|canonicalUrl)$/i.test(key)) add(child);
      visit(child, depth + 1);
    }
  };
  const embeddedScripts = Array.from(payload.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi));
  try { visit(JSON.parse(payload)); } catch { /* resposta pode ser HTML, não JSON puro */ }
  for (const block of embeddedScripts) {
    try { visit(JSON.parse(block[1].trim())); } catch { /* malformed script is non-fatal */ }
  }
  for (const url of extractSitemapUrls(payload, baseUrl)) links.add(url);
  return Array.from(links);
}

export function extractPublicEventLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const absoluteBase = new URL(baseUrl);
  const $ = load(html, undefined, false);
  const addNormalizedLink = (url: URL) => links.add(sanitizePublicSourceUrl(url.href));
  $("a[href]").each((_, anchor) => {
    try {
      const href = $(anchor).attr("href");
      if (!href) return;
      const url = new URL(href, absoluteBase);
      if (url.origin !== absoluteBase.origin) return;
      const isArticket = url.pathname.startsWith("/e/") && url.hostname.includes("articket");
      const isBlacktag = /^\/(?:evento|eventos|event|events)\/[A-Za-z0-9._~-]+(?:\/|$)/i.test(url.pathname) && url.hostname.includes("blacktag");
      const isZig = /^\/eventos?\//i.test(url.pathname) && (url.hostname === "zig.tickets" || url.hostname.endsWith(".zig.tickets"));
      const isIngresseEvent = isIngresseEventUrl(url.href);
      const isBlackPass = url.hostname.endsWith("blackpass.com.br") && /^\/event\/[A-Za-z0-9_-]+/.test(url.pathname);
      const isMrIngressos = url.hostname.endsWith("mringressos.com.br") && /^\/comprar\/[A-Za-z0-9_-]+/.test(url.pathname);
      const isSympla = url.hostname.endsWith("sympla.com.br") && /^\/evento\/[A-Za-z0-9-]+\/[0-9]+/.test(url.pathname);
      const isWeTicket = url.hostname.endsWith("weticket.com.br") && /^\/[A-Za-z0-9][A-Za-z0-9-]+$/.test(url.pathname) && !["/perguntas-frequentes", "/politica-de-privacidade", "/termos-de-uso"].includes(url.pathname.toLowerCase());
      const anchorText = $(anchor).text().replace(/\s+/g, " ").trim();
      const isZigRegional = !isZig || /santos|guaruj[aá]/i.test(normalizeText(anchorText));
      if ((isArticket || isBlacktag || isZig || isIngresseEvent || isBlackPass || isMrIngressos || isSympla || isWeTicket || isSupportedPublicEventUrl(url)) && isZigRegional) addNormalizedLink(url);
    } catch {
      // Ignore malformed public links.
    }
  });
  const collectEmbeddedPath = (value: string) => {
    try {
      const path = value.match(/(?:^|["'\\])((?:\/(?:evento|eventos|event|events)\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)?|\/e\/\d+(?:\/[A-Za-z0-9._~-]+)?|\/comprar\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?))(?:\?[^"'\\\s]*)?(?:#[^"'\\\s]*)?(?:["'\\]|$)/i)?.[1];
      if (path) {
        const url = new URL(path, absoluteBase);
        const host = url.hostname.toLowerCase();
        const isBlacktagRoute = host.includes("blacktag") && /^\/(?:evento|eventos|event|events)\/[A-Za-z0-9._~-]+(?:\/|$)/i.test(url.pathname);
        const isArticketRoute = host.includes("articket") && /^\/e\/\d+(?:\/|$)/i.test(url.pathname);
        const isBlackPassRoute = host.endsWith("blackpass.com.br") && /^\/event\/[A-Za-z0-9_-]+(?:\/|$)/i.test(url.pathname);
        const isMrIngressosRoute = host.endsWith("mringressos.com.br") && /^\/comprar\/[A-Za-z0-9_-]+(?:\/|$)/i.test(url.pathname);
        if (url.origin === absoluteBase.origin && (isBlacktagRoute || isArticketRoute || isBlackPassRoute || isMrIngressosRoute)) addNormalizedLink(url);
      }
      for (const match of Array.from(value.matchAll(/(?:https:\/\/www\.sympla\.com\.br)?(\/evento\/[A-Za-z0-9-]+\/[0-9]+)/g))) {
        const url = new URL(match[1], "https://www.sympla.com.br");
        if (url.origin === absoluteBase.origin) addNormalizedLink(url);
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
  for (const url of extractEmbeddedPublicEventUrls(html, baseUrl)) links.add(url);
  for (const url of extractSitemapUrls(html, baseUrl)) links.add(url);
  return Array.from(links).slice(0, 120);
}

export type ArticketCandidateHint = { url: string; name?: string | null; text?: string | null };

export function isArticketRegionalCandidate(candidate: ArticketCandidateHint, aliases: string[] = []) {
  const searchable = normalizeText(`${candidate.name ?? ""} ${candidate.text ?? ""} ${candidate.url}`);
  return /santos|guaruja|sao vicente|praia grande|cubatao/.test(searchable)
    || aliases.some(alias => searchable.includes(normalizeText(alias)));
}

export function filterArticketRegionalCandidates(candidates: ArticketCandidateHint[], aliases: string[]) {
  const regional: ArticketCandidateHint[] = [];
  const filtered: ArticketCandidateHint[] = [];
  for (const candidate of candidates) {
    (isArticketRegionalCandidate(candidate, aliases) ? regional : filtered).push(candidate);
  }
  return { regional, filtered };
}

export function discoverArticketEventLinks(html: string, baseUrl: string, aliases: string[] = []) {
  const absoluteBase = new URL(baseUrl);
  if (!absoluteBase.hostname.endsWith("articket.com.br")) return [];
  const $ = load(html, undefined, false);
  const links = new Set<string>();
  $("a[href]").each((_, anchor) => {
    try {
      const href = $(anchor).attr("href");
      if (!href) return;
      const url = new URL(href, absoluteBase);
      if (url.origin !== absoluteBase.origin || !/^\/e\/[A-Za-z0-9_-]+/.test(url.pathname)) return;
      const cardText = $(anchor).closest("article, li, [class*='event'], [class*='card'], section").first().text().replace(/\s+/g, " ").trim() || $(anchor).parent().text().replace(/\s+/g, " ").trim();
      const searchable = normalizeText(cardText);
      if (isArticketRegionalCandidate({ url: url.toString(), text: searchable }, aliases)) links.add(sanitizePublicSourceUrl(url.toString()));
    } catch {
      // Ignore malformed Articket links.
    }
  });
  return Array.from(links).slice(0, 60);
}

function readJsonLd(html: string) {
  const $ = load(html, undefined, false);
  let found: Record<string, unknown> | undefined;
  $("script[type='application/ld+json'], script[type='application/json']").each((_, script) => {
    if (found) return false;
    try {
      const parsed = JSON.parse($(script).contents().text().trim()) as unknown;
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      const values = roots.flatMap(value => {
        if (!value || typeof value !== "object") return [];
        const record = value as Record<string, unknown>;
        return Array.isArray(record["@graph"]) ? record["@graph"] : [value];
      });
      const event = values.find(value => {
        if (!value || typeof value !== "object") return false;
        const record = value as Record<string, unknown>;
        const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
        return types.some(type => String(type ?? "").toLowerCase() === "event") || "startDate" in record;
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

type ParsedEventDate = { value: string; timeEstimated: boolean };
function parseEventDateValue(value: string): ParsedEventDate | undefined {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoDate && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) return { value: `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T20:00:00-03:00`, timeEstimated: true };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) return { value: normalized, timeEstimated: false };
  const numeric = normalized.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[^0-9]{1,12}(\d{1,2})(?::|h)(\d{2})?)?/i);
  if (numeric) {
    return {
      value: `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}T${(numeric[4] ?? "20").padStart(2, "0")}:${numeric[5] ?? "00"}:00-03:00`,
      timeEstimated: !numeric[4],
    };
  }
  const months: Record<string, string> = { janeiro: "01", fevereiro: "02", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };
  const textual = normalized.match(/\b(\d{1,2})\s*(?:de\s+)?([a-zç]+)\s*(?:de\s+)?(\d{4})(?:[^0-9]{1,12}(\d{1,2})(?::|h)(\d{2})?)?/i);
  if (!textual) return undefined;
  const month = months[normalizeText(textual[2])];
  if (!month) return undefined;
  return {
    value: `${textual[3]}-${month}-${textual[1].padStart(2, "0")}T${(textual[4] ?? "20").padStart(2, "0")}:${textual[5] ?? "00"}:00-03:00`,
    timeEstimated: !textual[4],
  };
}
export function parsePortugueseEventDate(value: string) {
  return parseEventDateValue(value)?.value ?? "";
}

function readZigEmbeddedEvent(html: string) {
  const scripts = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi));
  const visit = (value: unknown, depth = 0): Record<string, unknown> | undefined => {
    if (depth > 8 || value === null || value === undefined) return undefined;
    if (Array.isArray(value)) { for (const item of value) { const found = visit(item, depth + 1); if (found) return found; } return undefined; }
    if (typeof value !== "object") return undefined;
    const record = value as Record<string, unknown>;
    const hasTitle = typeof record.name === "string" || typeof record.title === "string";
    const hasDate = typeof record.startDate === "string" || typeof record.eventDate === "string" || typeof record.date === "string";
    if (hasTitle && hasDate && (record.location || record.venue || record.address)) return record;
    for (const child of Object.values(record)) { const found = visit(child, depth + 1); if (found) return found; }
    return undefined;
  };
  for (const script of scripts) {
    try { const found = visit(JSON.parse(script[1].trim())); if (found) return found; } catch { /* non-JSON script */ }
  }
  return undefined;
}

export function parseZigEventMetadata(html: string, url: string) {
  let jsonLd: Record<string, unknown> | undefined;
  try {
    jsonLd = readJsonLd(html);
  } catch {
    jsonLd = undefined;
  }
  jsonLd ??= readZigEmbeddedEvent(html);
  const location = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  const offers = Array.isArray(jsonLd?.offers) ? (jsonLd.offers.find(item => item && typeof item === "object") as Record<string, unknown> | undefined) ?? {} : jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : {};
  const meta = readMetaTags(html);
  const text = stripHtml(html);
  const sourceText = `${text} ${meta("og:description")}`.replace(/\s+/g, " ").trim();
  const title = typeof jsonLd?.name === "string" ? jsonLd.name.trim() : meta("og:title").trim() || html.match(/^#\s+([^\n]+)$/m)?.[1]?.trim() || sourceText.slice(0, 160);
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate : typeof jsonLd?.eventDate === "string" ? jsonLd.eventDate : meta("event:start_time") || parsePortugueseEventDate(sourceText.match(/Quando:\s*([^\n|]+)/i)?.[1] ?? sourceText);
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
        : /laroc/i.test(`${title} ${sourceText} ${url}`) ? "Laroc Club"
        : /moby\s*dick/i.test(`${title} ${sourceText} ${url}`) ? "Moby Dick"
        : /vallum/i.test(`${title} ${sourceText} ${url}`) ? "Vallum Garden"
        : "";
  const city = typeof address.addressLocality === "string" ? address.addressLocality.trim() : (/guaruj[aá]/i.test(sourceText) ? "Guarujá" : /santos/i.test(sourceText) ? "Santos" : /laroc/i.test(`${title} ${sourceText} ${url}`) ? "Guarujá" : /moby\s*dick|vallum/i.test(`${title} ${sourceText} ${url}`) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : sourceText.match(/Endereço:\s*([^|]+)/i)?.[1]?.trim() ?? "";
  const priceCents = readPriceCents(offers.price ?? offers.lowPrice ?? offers.minPrice) || readPriceCents(sourceText.match(/R\$\s*[\d.,]+/i)?.[0] ?? "");
  const imageUrl = meta("og:image");
  const searchable = normalizeText(`${title} ${String(jsonLd?.description ?? "")} ${sourceText} ${locationName}`);
  const genre = /funk/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : /house|eletronic|eletrônica|dj|balada|festa|m[uú]sica|music|sunset/.test(searchable) ? "house_eletronica" : "";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : /balada|festa|dj|boate|reveillon|sunset|open\s+bar/.test(searchable) ? "balada" : genre ? "evento_musical" : "";
  if (!title || !eventDate || !city) return undefined;
  return { title: sanitizeEventText(title), summary: sanitizeEventText(sourceText.slice(0, 4_000)), eventDate, locationName, address: street, city, category, genre, priceCents, sourceUrl: url, imageUrl, latitude: "", longitude: "", text: sanitizeEventText(sourceText.slice(0, 16_000)) };
}

function normalizeZigApiDate(value: string, timezone?: string | null) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
  return timezone === "America/Sao_Paulo" || timezone === "America/Fortaleza" || !timezone ? `${trimmed}-03:00` : trimmed;
}

export function parseZigApiEventPayload(payload: unknown, url: string) {
  const root = asRecord(payload);
  const candidate = Array.isArray(root.data) ? root.data.find(item => asRecord(item).url === url || asRecord(item).slug === url.split("/").filter(Boolean).at(-1)) ?? root.data[0] : root.data ?? payload;
  const event = asRecord(candidate);
  const location = asRecord(event.location);
  const images = asRecord(event.images);
  const title = firstText(event.name, event.title);
  const description = stripHtml(firstText(event.description, event.summary));
  const locationName = firstText(location.name, event.locationName, event.venueName);
  const city = firstText(location.city, event.city) || (/guaruj[aá]/i.test(`${title} ${description} ${locationName} ${url}`) ? "Guarujá" : /santos/i.test(`${title} ${description} ${locationName} ${url}`) ? "Santos" : "");
  const timezone = firstText(event.timezone) || null;
  const eventDate = normalizeZigApiDate(firstText(event.starts_at, event.startsAt, event.startDate, event.eventDate), timezone);
  const address = firstText(location.formatted_address, event.address);
  const imageUrl = firstText(images.banner, images.thumbnail, event.image, event.imageUrl);
  const sourceUrl = firstText(event.url) || url;
  const searchable = normalizeText(`${title} ${description} ${locationName} ${address}`);
  const genre = /funk/.test(searchable) ? "rap_trap" : /rap|trap/.test(searchable) ? "rap_trap" : /house|eletronic|eletrônica|techno|trance|dj|balada|festa|music|sunset/.test(searchable) ? "house_eletronica" : "";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : /balada|festa|dj|boate|reveillon|sunset|open\s+bar/.test(searchable) ? "balada" : genre ? "evento_musical" : "";
  if (!title || !eventDate || !locationName || !city) return undefined;
  return { title: sanitizeEventText(title), summary: sanitizeEventText(description.slice(0, 4_000)), eventDate, locationName, address: sanitizeEventText(address), city, category, genre, priceCents: 0, sourceUrl, imageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : "", latitude: firstText(location.latitude), longitude: firstText(location.longitude), text: sanitizeEventText(`${title} ${description} ${locationName} ${address} ${city}`.slice(0, 16_000)) };
}

export function extractZigApiEventUrls(payload: unknown) {
  const root = asRecord(payload);
  const events = Array.isArray(root.data) ? root.data : Array.isArray(payload) ? payload : [];
  return Array.from(new Set(events.map(item => {
    const event = asRecord(item);
    const explicit = firstText(event.url);
    if (explicit) return explicit;
    const slug = firstText(event.slug);
    return slug ? `${ZIG_PUBLIC_SITE_BASE}/evento/${encodeURIComponent(slug)}` : "";
  }).filter(url => /^https?:\/\/(?:m\.)?zig\.tickets\/(?:evento|eventos|e)\//i.test(url))));
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
  return { title: sanitizeEventText(title), summary: sanitizeEventText(visibleText.slice(0, 4_000)), eventDate, locationName: venue, address, city, category, genre, priceCents: 0, sourceUrl: url, imageUrl, latitude: "", longitude: "", text: sanitizeEventText(visibleText.slice(0, 16_000) ) };
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
  try { const parsed = new URL(url); return parsed.hostname.endsWith("santosconventioncenter.com.br") && /\/agenda(?:-2026)?\/?$/.test(parsed.pathname); } catch { return false; }
}

type GandayaListingEvent = { id?: string | number; alias?: string; splashImageKey?: string | null; title?: string; date?: string; description?: string; location?: string; lowestTicketPrice?: number | string | null };
type GandayaEvent = GandayaListingEvent & { imageKey?: string | null; compressedImageKey?: string | null; endDate?: string; location?: { name?: string; address?: string; latitude?: number; longitude?: number } | string | null };

function gandayaImageUrl(key: unknown) { return typeof key === "string" && key.trim() ? `https://gandaya-prod.s3.us-east-2.amazonaws.com/${key.trim()}` : ""; }
function gandayaEventUrl(alias: unknown) { return typeof alias === "string" && alias.trim() ? `https://gandaya.dance/events/${encodeURIComponent(alias.trim())}` : ""; }
function cleanPublicDescription(value: unknown) { return sanitizeEventText(String(value ?? "")).replace(/\s{2,}/g, " ").trim().slice(0, 4_000); }
function inferGandayaGenre(title: string, description: string) {
  const searchable = normalizeText(`${title} ${description}`);
  return /funk/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : /house|eletronic|eletrônica|dj|balada|festa|m[uú]sica|music|sunset/.test(searchable) ? "house_eletronica" : "";
}

export function parseGandayaEventMetadata(event: GandayaEvent, url = gandayaEventUrl(event.alias)) {
  const title = sanitizeEventText(String(event.title ?? "")).trim();
  const description = cleanPublicDescription(event.description);
  const location = typeof event.location === "object" && event.location ? event.location as { name?: string; address?: string; latitude?: number; longitude?: number } : {};
  const locationName = typeof location === "object" ? String(location.name ?? "").trim() : String(event.location ?? "").trim();
  const address = typeof location === "object" ? String(location.address ?? "").trim() : "";
  const cityMatch = `${locationName} ${address}`.match(/Santos|Guarujá|Guaruja|São Vicente|Sao Vicente|Praia Grande|Cubatão|Cubatao/i)?.[0] ?? "";
  const city = normalizeRegionalCity(cityMatch);
  const eventDate = String(event.date ?? "").trim();
  const genre = inferGandayaGenre(title, description);
  const category = /show|festival|concerto|banda/.test(normalizeText(`${title} ${description}`)) ? "show" : genre ? "balada" : "";
  if (!title || !eventDate || !locationName || !city || !genre || !category || !url) return undefined;
  const coords = typeof location === "object" ? location : {};
  return { title, summary: description || title, eventDate, locationName, address, city, category, genre, priceCents: readPriceCents(event.lowestTicketPrice), sourceUrl: url, imageUrl: gandayaImageUrl(event.imageKey ?? event.splashImageKey ?? event.compressedImageKey), latitude: String(coords.latitude ?? ""), longitude: String(coords.longitude ?? ""), text: sanitizeEventText(`${title} ${description} ${locationName} ${address} ${city}`).slice(0, 16_000) };
}

export function extractGandayaEventLinks(payload: unknown) {
  const candidates: GandayaListingEvent[] = [];
  if (payload && typeof payload === "object") {
    const root = payload as { main?: unknown; sections?: unknown; otherEvents?: unknown };
    if (root.main && typeof root.main === "object") candidates.push(root.main as GandayaListingEvent);
    for (const section of Array.isArray(root.sections) ? root.sections : []) if (section && typeof section === "object" && Array.isArray((section as { events?: unknown }).events)) candidates.push(...((section as { events: GandayaListingEvent[] }).events));
    if (Array.isArray(root.otherEvents)) candidates.push(...root.otherEvents.filter((item): item is GandayaListingEvent => Boolean(item && typeof item === "object")));
  }
  return Array.from(new Set(candidates.map(event => gandayaEventUrl(event.alias)).filter(Boolean)));
}
function isGandayaRootUrl(url: string) { try { const parsed = new URL(url); return parsed.hostname === "gandaya.dance" && ["", "/"].includes(parsed.pathname); } catch { return false; } }
function isGandayaEventUrl(url: string) { try { const parsed = new URL(url); return parsed.hostname === "gandaya.dance" && /^\/events\/[A-Za-z0-9._~-]+/.test(parsed.pathname); } catch { return false; } }
function parseGandayaListingPayload(value: string) { try { return JSON.parse(value) as unknown; } catch { return undefined; } }

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
export function isPublicCatalogUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/$/, "");
    if (isSymplaEventUrl(url) || isBlackPassEventUrl(url) || isMrIngressosEventUrl(url) || isWeTicketEventUrl(url) || isIngresseEventUrl(url)) return false;
    if (host.endsWith("sympla.com.br")) return path === "/eventos" || path.startsWith("/eventos/");
    if (host.endsWith("ingresse.com")) return path === "/search" || path === "/eventos" || path === "/events";
    if (host.includes("blacktag")) return path === "" || path === "/eventos" || path === "/events";
    if (host.endsWith("blackpass.com.br")) return isBlackPassRootUrl(url);
    if (host.endsWith("mringressos.com.br")) return isMrIngressosCatalogUrl(url);
    if (host === "gandaya.dance") return isGandayaRootUrl(url);
    if (host.endsWith("weticket.com.br")) return path === "" || path === "/eventos" || path === "/events";
    if (host.endsWith("ticket360.com.br")) return path === "" || path === "/eventos" || path.startsWith("/eventos/");
    if (host.endsWith("zig.tickets")) return path === "" || path === "/pt-BR" || path === "/eventos" || path === "/event";
  } catch { /* malformed public URL */ }
  return false;
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
  const offers = Array.isArray(jsonLd?.offers) ? jsonLd.offers[0] as Record<string, unknown> | undefined : jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : undefined;
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
  const priceCents = readPriceCents(offers?.price ?? offers?.lowPrice) || (priceMatch ? Math.round(Number(priceMatch[1].replace(/\./g, "").replace(",", ".")) * 100) : 0);
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
  const jsonLd = readJsonLd(html);
  const meta = readMetaTags(html);
  const $ = load(html, undefined, false);
  $("script, style, noscript").remove();
  const visibleText = $.root().text().replace(/\s+/g, " ").trim();
  const jsonLocation = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const jsonAddress = jsonLocation.address && typeof jsonLocation.address === "object" ? jsonLocation.address as Record<string, unknown> : {};
  const jsonGeo = jsonLocation.geo && typeof jsonLocation.geo === "object" ? jsonLocation.geo as Record<string, unknown> : {};
  const jsonOffers = Array.isArray(jsonLd?.offers) ? jsonLd.offers[0] as Record<string, unknown> | undefined : jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : undefined;
  const address = state?.eventsAddress ?? {};
  const title = String(state?.name ?? jsonLd?.name ?? meta("og:title") ?? "").trim();
  const eventDate = String(state?.startDateMultiFormat?.ISO8601 ?? state?.startDate ?? jsonLd?.startDate ?? meta("event:start_time") ?? "").trim();
  const locationName = String(address.name ?? jsonLocation.name ?? (typeof jsonLd?.location === "string" ? jsonLd.location : "")).trim();
  const city = String(address.city ?? jsonAddress.addressLocality ?? "").trim();
  const addressLine = [address.address ?? jsonAddress.streetAddress, address.addressNum, address.neighborhood, city, address.state ?? jsonAddress.addressRegion].filter(value => typeof value === "string" && value.trim()).join(", ");
  const detail = typeof state?.strippedDetail === "string" ? state.strippedDetail : typeof state?.detail === "string" ? stripHtml(state.detail) : typeof jsonLd?.description === "string" ? stripHtml(jsonLd.description) : meta("og:description");
  const coordinates = address.geolocation ?? { latitude: jsonGeo.latitude, longitude: jsonGeo.longitude };
  const searchable = normalizeText(`${title} ${detail} ${locationName}`);
  const genre = /\bfunk\b/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : /house|eletronic|dj|balada|festa/.test(searchable) ? "house_eletronica" : "";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : /balada|festa|dj|boate/.test(searchable) ? "balada" : genre ? "evento_musical" : "";
  const priceMatch = `${visibleText} ${detail}`.match(/r\$\s*([\d.]+(?:,\d{2})?)/i);
  const priceCents = readPriceCents(jsonOffers?.price ?? jsonOffers?.lowPrice) || (priceMatch ? Math.round(Number(priceMatch[1].replace(/\./g, "").replace(",", ".")) * 100) : 0);
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
    imageUrl: String(state?.logoUrl || meta("og:image") || (typeof jsonLd?.image === "string" ? jsonLd.image : Array.isArray(jsonLd?.image) ? jsonLd.image[0] : "") || ""),
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

export const PUBLIC_ADAPTER_MAX_ATTEMPTS = 3;
export const PUBLIC_ADAPTER_RETRY_DELAYS_MS = [300, 1_200] as const;

function isRetryablePublicAdapterFailure(error: unknown) {
  const status = getHttpStatus(error);
  if (status !== null) return [502, 503, 504].includes(status);
  return isTimeoutFailure(error) || /fetch failed|econnreset|econnrefused|enotfound|eai_again|network|socket/i.test(String(error instanceof Error ? error.message : error));
}

async function fetchPublicAdapterJson<T>(input: string, init: RequestInit = {}, timeoutMs = 12_000, attempts = PUBLIC_ADAPTER_MAX_ATTEMPTS, externalSignal?: AbortSignal): Promise<T> {
  let lastError: unknown;
  const maxAttempts = Math.min(PUBLIC_ADAPTER_MAX_ATTEMPTS, Math.max(1, Math.trunc(attempts)));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetchExternal(input, init, timeoutMs, false, externalSignal);
      if (!response.ok) throw createFetchError(`Fonte pública respondeu ${response.status}`, response.status);
      return JSON.parse(await readExternalBody(response)) as T;
    } catch (error) {
      lastError = error;
      const failure = sanitizeFetchFailure(error);
      const currentAttempt = attempt + 1;
      if (!isRetryablePublicAdapterFailure(error) || currentAttempt >= maxAttempts) {
        console.warn("[Public adapter] request failed", { url: input, status: failure.status, attempts: currentAttempt, message: failure.message });
        const finalError = error instanceof Error ? error : new Error(failure.message);
        throw Object.assign(finalError, { attempts: currentAttempt, retryable: isRetryablePublicAdapterFailure(error), fetchFailure: { ...failure, attempts: currentAttempt } });
      }
      const delay = PUBLIC_ADAPTER_RETRY_DELAYS_MS[Math.min(attempt, PUBLIC_ADAPTER_RETRY_DELAYS_MS.length - 1)];
      await new Promise(resolve => setTimeout(resolve, delay));
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
  const parsedDate = typeof jsonLd?.startDate === "string"
    ? parseEventDateValue(jsonLd.startDate)
    : parseEventDateValue(meta("event:start_time") || visibleText);
  const eventDate = parsedDate?.value ?? "";
  const locationName = typeof location.name === "string" ? location.name : (visibleText.match(/(?:Guarujá|Guaruja|Santos)[^,|]{0,80}/i)?.[0] ?? "").trim();
  const rawCity = typeof address.addressLocality === "string" ? address.addressLocality : (/guaruj[aá]/i.test(visibleText) ? "Guarujá" : /santos/i.test(visibleText) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : "";
  const city = normalizeVenueCity(String(locationName), `${street} ${visibleText}`, rawCity);
  const priceRaw = typeof offers.price === "number" || typeof offers.price === "string" ? String(offers.price) : "";
  const priceCents = priceRaw ? Math.round(Number(priceRaw.replace(/[^0-9,.-]/g, "").replace(",", ".")) * 100) : 0;
  const offerNote = [offers.name, offers.description].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" — ").trim();
  const lotNote = visibleText.match(/(?:\d{1,2}[º°o]?|primeiro|segundo|terceiro)\s*lote[^.;|]{0,120}/i)?.[0]?.trim() ?? "";
  const priceNote = (offerNote || lotNote || undefined)?.slice(0, 255);
  if (!title || !eventDate || !locationName || !city) return undefined;
  return { title, eventDate, eventDateEstimated: parsedDate?.timeEstimated === true, locationName, address: street, city, priceCents, priceNote, sourceUrl: url, imageUrl: meta("og:image"), text: visibleText.slice(0, 16_000) };
}

export function parseArticketEventMetadata(html: string, url: string) {
  const parsed = parseTicketingEventMetadata(html, url);
  if (!parsed) return undefined;
  if (!parsed.title.trim() || !parsed.eventDate.trim() || !parsed.locationName.trim() || !parsed.city.trim()) return undefined;
  const searchable = normalizeText(`${parsed.title} ${parsed.text} ${parsed.locationName}`);
  const genre = /funk/.test(searchable) ? "funk" : /samba|pagode/.test(searchable) ? "samba_pagode" : /rap|trap/.test(searchable) ? "rap_trap" : /show|festival|m[uú]sica|dj|festa|balada|sertanejo|arrocha|pagode|halloween|open bar|plants/.test(searchable) ? "house_eletronica" : "";
  const category = /show|festival|concerto|banda/.test(searchable) ? "show" : /samba|pagode/.test(searchable) ? "evento_musical" : genre ? "balada" : "";
  return { ...parsed, summary: parsed.text.slice(0, 4_000), category, genre };
}

export function isIngresseEventUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    const isPublicSite = parsed.hostname === "www.ingresse.com" || parsed.hostname === "ingresse.com";
    return isPublicSite && path.length > 1 && !["/login", "/register", "/search"].includes(path);
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstText(...values: unknown[]) {
  return values.find(value => (typeof value === "string" && value.trim().length > 0) || (typeof value === "number" && Number.isFinite(value)))?.toString().trim() ?? "";
}

function firstDate(...values: unknown[]) {
  for (const value of values) {
    const candidate = firstText(value);
    if (!candidate) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(candidate)) return candidate;
    const parsed = parsePortugueseEventDate(candidate);
    if (parsed) return parsed;
  }
  return "";
}

export function parseIngresseEventPayload(payload: Record<string, unknown>, url: string) {
  const event = asRecord(payload.event);
  const jsonLd = asRecord(payload.jsonLd ?? payload.jsonLD ?? event.jsonLd);
  const place = asRecord(payload.place ?? payload.venue ?? event.place ?? event.venue);
  const placeAddress = asRecord(place.address ?? payload.address ?? event.address);
  const location = asRecord(place.location ?? payload.location ?? event.location);
  const sessions = Array.isArray(payload.sessions) ? payload.sessions.map(asRecord) : [];
  const dates = Array.isArray(payload.dates) ? payload.dates.map(asRecord) : [];
  const session = sessions.find(item => firstDate(item.dateTime, item.startDate, item.startsAt, item.date)) ?? dates.find(item => firstDate(item.dateTime, item.startDate, item.startsAt, item.date)) ?? {};
  const title = firstText(payload.title, payload.name, event.title, event.name, jsonLd.name);
  const description = stripHtml(firstText(payload.description, payload.summary, event.description, jsonLd.description));
  const visibleText = [title, description, JSON.stringify(payload)].join(" ").replace(/\s+/g, " ");
  const dateTime = firstDate(session.dateTime, session.startDate, session.startsAt, session.date, payload.startDate, payload.date, event.startDate, event.date, jsonLd.startDate, parsePortugueseEventDate(description), visibleText);
  const placeName = firstText(place.name, place.title, payload.placeName, payload.venueName, event.locationName, jsonLd.location && asRecord(jsonLd.location).name);
  const city = firstText(place.city, placeAddress.city, placeAddress.addressLocality, payload.city, event.city, jsonLd.location && asRecord(jsonLd.location).address && asRecord(asRecord(jsonLd.location).address).addressLocality)
    || (/guaruj[aá]/i.test(`${title} ${description} ${placeName}`) ? "Guarujá" : /santos/i.test(`${title} ${description} ${placeName}`) ? "Santos" : "");
  const jsonLdLocation = asRecord(jsonLd.location);
  const jsonLdAddress = asRecord(jsonLdLocation.address);
  const street = firstText(place.street, place.address, placeAddress.street, placeAddress.streetAddress, payload.address, event.address, jsonLdAddress.streetAddress);
  const state = firstText(place.state, placeAddress.state, placeAddress.addressRegion, jsonLdAddress.addressRegion);
  const address = [street, city, state].filter(Boolean).join(", ");
  const poster = asRecord(payload.poster ?? payload.banner ?? event.poster ?? event.banner);
  const imageUrl = [poster.xLarge, poster.large, poster.medium, poster.small, payload.ogImage, payload.image, jsonLd.image].find(value => typeof value === "string" && /^https?:\/\//i.test(value)) as string | undefined ?? "";
  const coordinates = asRecord(place.location ?? placeAddress.location ?? location);
  const latitude = firstText(coordinates.lat, coordinates.latitude);
  const longitude = firstText(coordinates.lon, coordinates.lng, coordinates.longitude);
  const purchaseUrl = firstText(payload.externalLink, payload.ticketUrl, event.url) || url;
  if (!title || !dateTime || !placeName) return undefined;
  return { title, summary: description, eventDate: dateTime, locationName: placeName, address, city, category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: purchaseUrl, imageUrl, latitude, longitude };
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
    const structured = parseIngresseEventPayload(payload, url);
    if (!structured) throw createFetchError(`API pública do Ingresse sem dados essenciais para ${url}`);
    const text = [structured.title, structured.summary, structured.locationName, structured.address, structured.city, structured.eventDate].filter(Boolean).join(" ");
    if (!options.dryRun) await cacheStore.write({ cacheKey: ingresseCacheKey(url), sourceKey: "public:ingresse", sourceUrl: url, payload: structured, latitude: structured.latitude, longitude: structured.longitude }).catch(error => console.warn("[Ingestion cache] Could not save Ingresse payload:", sanitizeFetchFailure(error).message));
    return { url, html: "", text: text.slice(0, 16_000), imageUrl: structured.imageUrl, structured };
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

export type PublicPage = {
  url: string;
  html: string;
  text: string;
  imageUrl: string;
  adapter?: "blackpass" | "mringressos" | "ingresse" | "sympla" | "weticket" | "ticket360" | "zig" | "articket" | "parque-valongo" | "eventos-litoral" | "blue-med" | "gandaya" | "generic";
  adapterError?: string;
  durationMs?: number;
  structured?: Record<string, string | number | boolean | undefined> | Array<Record<string, string | number | boolean | undefined>>;
  cacheFallback?: { used: true; status: number | null; message: string };
  fetchFailure?: FetchFailure;
  circuitOpen?: boolean;
  emptyHealthy?: boolean;
};

export function isHealthyEmptyPublicPage(page: Pick<PublicPage, "text" | "adapter" | "emptyHealthy">) {
  return page.emptyHealthy === true && page.text.trim() === "" && (page.adapter === "weticket" || page.adapter === "zig");
}

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
    if (host === "gandaya.dance" || host === "api.gandaya.dance") return "public:gandaya";
  } catch {
    // Keep malformed URLs under the generic public source.
  }
  return "public:unknown";
}

export async function guardedFetchPublicPage(url: string, options: { dryRun?: boolean; signal?: AbortSignal; bypassCircuitBreaker?: boolean } = {}): Promise<PublicPage> {
  const startedAt = Date.now();
  const sourceKey = publicSourceKey(url);
  if (!options.dryRun && !options.bypassCircuitBreaker) {
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
      const isolatedIngresseItem503 = sourceKey === "public:ingresse" && isIngresseEventUrl(url) && failure.status === 503;
      if (isolatedIngresseItem503) {
        console.warn("[Ingestion] Ingresse item returned HTTP 503; item isolated", { sourceKey, url: url.replace(/https?:\/\/[^/]+/i, "fonte pública"), attempts: failure.attempts ?? 1, errorCode: failure.errorCode });
      } else {
        try {
          await registerSourceFailure({ sourceKey, routine: "public-agenda", status: failure.status ?? undefined, message: failure.message });
        } catch (registrationError) {
          console.warn("[Ingestion] Could not persist isolated public source failure:", sanitizeFetchFailure(registrationError).message);
        }
      }
    }
    throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure, fetchDurationMs: Math.max(0, Date.now() - startedAt) });
  }
}

const PUBLIC_FETCH_TIMEOUT_MS = 12_000;
export const ARTICKET_FETCH_TIMEOUT_MS = 12_000;
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
  if (sourceKey === "public:gandaya") return GANDAYA_FETCH_TIMEOUT_MS;
  return PUBLIC_FETCH_TIMEOUT_MS;
}
export const MR_INGRESSOS_RETRY_ATTEMPTS = 3;
export const MR_INGRESSOS_RETRY_BASE_DELAY_MS = 250;

export function isTimeoutFailure(error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name ?? "") : "";
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return code === "TIMEOUT" || name === "TimeoutError" || name === "AbortError" || /timeout|timed out|aborted|tempo limite/i.test(message);
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
    sourceReports: [{ sourceKey, read: 3, filtered: 0, persistable: dryRun ? 3 : 0, added: 0, updated: 0, ignored: 0, duplicates: 0, errors: [], durationMs, medianDurationMs: durationMs, p95DurationMs: durationMs, regionalFiltered: 0, regionalProcessed: 0, rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
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

async function fetchZigEventApi(url: string, options: { signal?: AbortSignal } = {}) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  if (!slug) return undefined;
  const endpoints = [
    `${ZIG_PUBLIC_API_BASE}/events/${encodeURIComponent(slug)}`,
    `https://api.zig.tickets/v1/events/${encodeURIComponent(slug)}`,
    `https://api.zig.tickets/events/${encodeURIComponent(slug)}`,
    `https://zig.tickets/api/events/${encodeURIComponent(slug)}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetchExternal(endpoint, { headers: { ...ZIG_REQUEST_HEADERS, accept: "application/json", origin: ZIG_PUBLIC_SITE_BASE, referer: url } }, ZIG_FETCH_TIMEOUT_MS, false, options.signal);
      const body = await readExternalBody(response);
      let payload: unknown;
      try { payload = JSON.parse(body); } catch { payload = undefined; }
      const structured = parseZigApiEventPayload(payload, url) ?? parseZigEventMetadata(`<script type="application/ld+json">${body}</script>`, url);
      if (structured) return structured;
    } catch {
      // 403/404 and unavailable API variants are safe fallbacks to the public shell.
    }
  }
  return undefined;
}

export async function fetchZigRegionalEventLinks(city: "Santos" | "Guarujá", options: { signal?: AbortSignal } = {}) {
  const query = new URLSearchParams({ city, state: "SP", page: "1", per_page: "50" });
  try {
    const response = await fetchExternal(`${ZIG_PUBLIC_API_BASE}/events?${query}`, { headers: { ...ZIG_REQUEST_HEADERS, accept: "application/json", origin: ZIG_PUBLIC_SITE_BASE, referer: `${ZIG_PUBLIC_SITE_BASE}/pt-BR?city=${city.toLowerCase()}` } }, ZIG_FETCH_TIMEOUT_MS, false, options.signal);
    const body = await readExternalBody(response);
    const payload = JSON.parse(body) as unknown;
    return { payload, urls: extractZigApiEventUrls(payload) };
  } catch {
    return { payload: undefined, urls: [] as string[] };
  }
}

export type ApifyCatalogFallbackResult = {
  links: string[];
  attempted: boolean;
  status: "not_configured" | "succeeded" | "empty" | "timeout" | "failed";
  message?: string;
};

export function buildApifyCatalogPayload(urls: string[], actorId = process.env.APIFY_CATALOG_ACTOR_ID || process.env.APIFY_WEB_ACTOR_ID || "apify~cheerio-scraper") {
  const eventPathExpression = "/\\/(?:evento|eventos|e|event)\\/[^\\/]+(?:\\/[^\\/]*)?$/i";
  const pageFunction = actorId.toLowerCase().includes("puppeteer")
    ? `async ({ page, request }) => { await page.waitForSelector('a[href]', { timeout: 8000 }).catch(() => {}); await page.evaluate(() => window.scrollBy(0, Math.min(window.innerHeight * 2, 1600))); const pattern = ${eventPathExpression}; const links = await page.$$eval('a[href]', anchors => anchors.map(anchor => ({ url: new URL(anchor.href, location.href).href, title: (anchor.textContent || anchor.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim() })).filter(item => { const parsed = new URL(item.url); return parsed.origin === location.origin && pattern.test(parsed.pathname) && !/^\\/eventos\\/(?:santos|guaruja)-sp\\/?$/i.test(parsed.pathname) && !/login|categoria|category|termos|privacidade|ingresso\\?/.test(parsed.pathname + parsed.search); })); return Array.from(new Map(links.map(item => [item.url, item])).values()); }`.replace("pattern = ${eventPathExpression}", `pattern = new RegExp(${JSON.stringify(eventPathExpression.slice(1, -2))}, 'i')`)
    : `async ({ $, request }) => { const pattern = new RegExp(${JSON.stringify(eventPathExpression.slice(1, -2))}, 'i'); return $('a[href]').map((_, anchor) => ({ url: new URL($(anchor).attr('href'), request.url).href, title: $(anchor).text().replace(/\\s+/g, ' ').trim() })).get().filter(item => { const parsed = new URL(item.url); return parsed.origin === new URL(request.url).origin && pattern.test(parsed.pathname) && !/^\\/eventos\\/(?:santos|guaruja)-sp\\/?$/i.test(parsed.pathname) && !/login|categoria|category|termos|privacidade|ingresso\\?/.test(parsed.pathname + parsed.search); }).filter((item, index, all) => all.findIndex(candidate => candidate.url === item.url) === index); }`;
  return {
    startUrls: urls.slice(0, 2).map(url => ({ url })),
    pageFunction,
    maxCrawlPages: 20,
    maxConcurrency: 2,
  };
}

export function shouldRunApifyCatalogFallback(baseUrl: string, page: Pick<PublicPage, "circuitOpen">, options: { exploratoryApify?: boolean } = {}) {
  return isPublicCatalogUrl(baseUrl) && (!page.circuitOpen || options.exploratoryApify === true);
}

export async function fetchApifyCatalogLinks(urls: string[], options: { signal?: AbortSignal } = {}): Promise<ApifyCatalogFallbackResult> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  const actorId = (process.env.APIFY_CATALOG_ACTOR_ID || process.env.APIFY_WEB_ACTOR_ID || "apify~cheerio-scraper").trim();
  if (!token || urls.length === 0) return { links: [], attempted: false, status: "not_configured", message: "APIFY_API_TOKEN ausente ou nenhum catálogo elegível." };
  try {
    const actorPath = encodeURIComponent(actorId).replace(/%7E/gi, "~");
    const response = await fetchExternal(`https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=45`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "WeekendVibes/1.0" },
      body: JSON.stringify(buildApifyCatalogPayload(urls, actorId)),
    }, 45_000, true, options.signal);
    const body = await readExternalBody(response);
    const links = extractEmbeddedPublicEventUrls(body, urls[0]);
    return { links, attempted: true, status: links.length > 0 ? "succeeded" : "empty", message: links.length > 0 ? undefined : "Actor concluiu sem retornar links /evento/." };
  } catch (error) {
    const message = sanitizeFetchFailure(error).message;
    return { links: [], attempted: true, status: isTimeoutFailure(error) ? "timeout" : "failed", message };
  }
}

async function fetchPublicPage(url: string, options: { dryRun?: boolean; signal?: AbortSignal } = {}): Promise<PublicPage> {
  if (isIngresseEventUrl(url)) return fetchIngresseEventApi(url, { read: getIngestionPayloadCache, write: saveIngestionPayloadCache }, options);
  if (isBlackPassEventUrl(url)) return fetchBlackPassEventPage(url);
  if (isGandayaRootUrl(url) || isGandayaEventUrl(url)) {
    const endpoint = isGandayaRootUrl(url) ? `${GANDAYA_API_BASE}/events/front-page` : `${GANDAYA_API_BASE}/events/${new URL(url).pathname.split("/").filter(Boolean).at(-1)}`;
    let response: Response;
    try {
      response = await fetchExternal(endpoint, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0", "cache-control": "no-cache" } }, GANDAYA_FETCH_TIMEOUT_MS, false, options.signal);
    } catch (error) {
      if (!isTimeoutFailure(error) && !/fetch failed|econn|enotfound|eai_again|network|socket/i.test(String(error))) throw error;
      await new Promise(resolve => setTimeout(resolve, 150));
      response = await fetchExternal(endpoint, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0", "cache-control": "no-cache" } }, GANDAYA_FETCH_TIMEOUT_MS, false, options.signal);
    }
    const payloadText = await readExternalBody(response);
    const payload = parseGandayaListingPayload(payloadText);
    if (!payload) throw createFetchError("API pública Gandaya retornou JSON inválido");
    if (isGandayaRootUrl(url)) {
      const text = JSON.stringify(payload).slice(0, 16_000);
      return { url, html: payloadText, text, imageUrl: "", adapter: "gandaya" };
    }
    const structured = parseGandayaEventMetadata(payload as GandayaEvent, url);
    if (!structured) throw createFetchError(`API pública Gandaya sem dados regionais completos para ${url}`);
    return { url, html: payloadText, text: structured.text, imageUrl: structured.imageUrl, structured, adapter: "gandaya" };
  }
  if (isWeTicketEventUrl(url)) {
    const response = await fetchExternal(url, { headers: WETICKET_REQUEST_HEADERS }, WETICKET_FETCH_TIMEOUT_MS, false, options.signal);
    const html = await readExternalBody(response);
    const structured = parseWeTicketEventMetadata(html, url);
    const meta = readMetaTags(html);
    const text = structured?.text ?? meta("og:description") ?? "";
    if (!text) return { url, html, text: "", imageUrl: structured?.imageUrl ?? meta("og:image") ?? "", structured, adapter: "weticket", emptyHealthy: true };
    return { url, html, text: text.slice(0, 16_000), imageUrl: structured?.imageUrl ?? meta("og:image") ?? "", structured, adapter: "weticket", adapterError: structured ? undefined : "Adaptador WeTicket não encontrou dados estruturados completos." };
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
    const structured = parseZigEventMetadata(html, url) ?? await fetchZigEventApi(url, options);
    const meta = readMetaTags(html);
    const text = structured?.text ?? meta("og:description") ?? "";
    if (!text) return { url, html, text: "", imageUrl: structured?.imageUrl ?? meta("og:image") ?? "", structured, adapter: "zig", emptyHealthy: true };
    return { url, html, text: text.slice(0, 16_000), imageUrl: structured?.imageUrl ?? meta("og:image") ?? "", structured, adapter: "zig", adapterError: structured ? undefined : "Adaptador Zig não encontrou metadados públicos completos." };
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
    const preferredUrl = url.replace(/^http:\/\//i, "https://");
    let response: Response;
    try {
      response = await fetchExternal(preferredUrl, { headers: SANTOS_PUBLIC_REQUEST_HEADERS }, PARQUE_VALONGO_FETCH_TIMEOUT_MS, false, options.signal);
    } catch (error) {
      if (/^https:\/\//i.test(preferredUrl) && (isTimeoutFailure(error) || [502, 503, 504].includes(getHttpStatus(error) ?? 0))) {
        response = await fetchExternal(preferredUrl.replace(/^https:\/\//i, "http://"), { headers: SANTOS_PUBLIC_REQUEST_HEADERS }, PARQUE_VALONGO_FETCH_TIMEOUT_MS, false, options.signal);
      } else throw error;
    }
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
      ? await fetchMrIngressosWithRetry(url, requestInit, (targetUrl: string | URL | Request, targetInit?: RequestInit) => fetchExternal(targetUrl instanceof Request ? targetUrl.url : String(targetUrl), targetInit ?? {}, MR_INGRESSOS_FETCH_TIMEOUT_MS, false, options.signal))
      : await fetchExternal(url, requestInit, publicFetchTimeoutMs(url), false, options.signal);
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

export async function discoverCandidatePages(options: IngestionPipelineOptions = {}, activeAliases: string[] = []) {
  const requestedSourceUrls = options.sourceUrls?.map(sanitizePublicSourceUrl);
  const configuredBases = filterExplicitPublicSourceUrls(await getEnabledConfiguredSourceUrls(), requestedSourceUrls);
  const exploratoryBases = filterExplicitPublicSourceUrls(options.exploratorySourceUrls ?? [], requestedSourceUrls);
  const bases = options.sourceKey
    ? Array.from(new Set([...configuredBases, ...exploratoryBases])).filter(url => options.sourceKey === "public" || publicSourceKey(url) === options.sourceKey)
    : Array.from(new Set([...configuredBases, ...exploratoryBases]));
  const sourceHints = await listIngestionSources().catch(() => []);
  const sourceByUrl = new Map(sourceHints.map(source => [sanitizePublicSourceUrl(source.url), source]));
  const directArticketCandidates = bases.filter(isArticketEventUrl).map(url => ({
    url,
    name: sourceByUrl.get(sanitizePublicSourceUrl(url))?.name,
    text: sourceByUrl.get(sanitizePublicSourceUrl(url))?.sourceKey,
  }));
  const regionalArticketCandidates = filterArticketRegionalCandidates(directArticketCandidates, activeAliases);
  let gandayaRegionalFiltered = 0;
  const crawlBases = bases.filter(url => !isIngresseCatalogRootUrl(url) && !isArticketEventUrl(url)).sort((left, right) => {
    const leftIsSympla = publicSourceKey(left) === "public:sympla" ? 0 : 1;
    const rightIsSympla = publicSourceKey(right) === "public:sympla" ? 0 : 1;
    return leftIsSympla - rightIsSympla;
  });
  const discovered = new Set([...crawlBases.filter(url => !isPublicCatalogUrl(url)), ...regionalArticketCandidates.regional.map(candidate => candidate.url)]);
  const apifyStats: Array<{ sourceKey: string; urls: string[]; status: ApifyCatalogFallbackResult["status"]; attempted: boolean; message?: string }> = [];
  const basePages = await fetchWithConcurrency(crawlBases, url => guardedFetchPublicPage(url, { ...options, bypassCircuitBreaker: options.exploratoryApify === true }), PUBLIC_FETCH_CONCURRENCY);
  const zigCatalogs = crawlBases.filter(url => publicSourceKey(url) === "public:zig" && isPublicCatalogUrl(url));
  const zigRegionalPages = await fetchWithConcurrency(Array.from(new Set(zigCatalogs.map(url => /guaruja/i.test(url) ? "Guarujá" : "Santos" as const))), city => fetchZigRegionalEventLinks(city, options), Math.min(2, PUBLIC_FETCH_CONCURRENCY));
  for (const result of zigRegionalPages) if (result.status === "fulfilled") for (const link of result.value.urls) discovered.add(link);
  const endpointUrls = crawlBases.flatMap(baseUrl => {
    try {
      const origin = new URL(baseUrl).origin;
      const city = /guaruja/i.test(baseUrl) ? "guaruja" : "santos";
      if (publicSourceKey(baseUrl) === "public:zig") return [];
      return [
        `${origin}/api/events?city=${city}`,
        `${origin}/api/search?city=${city}`,
        `${origin}/api/events/search?city=${city}`,
      ];
    } catch { return []; }
  }).filter(url => ["public:sympla", "public:ingresse", "public:zig", "public:blacktag"].includes(publicSourceKey(url)));
  const endpointPages = endpointUrls.length
    ? await fetchWithConcurrency(endpointUrls, url => guardedFetchPublicPage(url, options), Math.min(4, PUBLIC_FETCH_CONCURRENCY))
    : [];
  for (let index = 0; index < endpointPages.length; index += 1) {
    const result = endpointPages[index];
    if (result.status !== "fulfilled") continue;
    for (const link of extractEmbeddedPublicEventUrls(result.value.html, result.value.url)) discovered.add(link);
  }
  const sitemapUrls = Array.from(new Set(crawlBases.flatMap(baseUrl => {
    try {
      const origin = new URL(baseUrl).origin;
      return [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
    } catch { return []; }
  })));
  const sitemapPages = sitemapUrls.length
    ? await fetchWithConcurrency(sitemapUrls, url => guardedFetchPublicPage(url, options), Math.min(4, PUBLIC_FETCH_CONCURRENCY))
    : [];
  for (const result of sitemapPages) {
    if (result.status !== "fulfilled") continue;
    for (const link of extractSitemapUrls(result.value.html, result.value.url)) discovered.add(link);
  }
  for (let index = 0; index < basePages.length; index += 1) {
    const result = basePages[index];
    const baseUrl = crawlBases[index];
    const page = result.status === "fulfilled" ? result.value : undefined;
    const extractedLinks = page ? extractPublicEventLinks(page.html, page.url) : [];
    for (const link of extractedLinks) discovered.add(link);
    const apifyEligible = isPublicCatalogUrl(baseUrl) && (options.exploratoryApify === true || (page ? shouldRunApifyCatalogFallback(baseUrl, page, options) : false));
    if (extractedLinks.length === 0 && apifyEligible) {
      const fallback = await fetchApifyCatalogLinks([baseUrl], options);
      for (const link of fallback.links) discovered.add(link);
      apifyStats.push({ sourceKey: publicSourceKey(baseUrl), urls: [baseUrl], status: fallback.status, attempted: fallback.attempted, message: fallback.message });
    }
    if (!page) continue;
    if (publicSourceKey(baseUrl) === "public:gandaya") {
      const payload = parseGandayaListingPayload(page.html);
      const listingEvents = payload && typeof payload === "object" ? [
        ...((payload as { main?: GandayaListingEvent }).main ? [(payload as { main: GandayaListingEvent }).main] : []),
        ...((payload as { sections?: Array<{ events?: GandayaListingEvent[] }> }).sections ?? []).flatMap(section => section.events ?? []),
        ...((payload as { otherEvents?: GandayaListingEvent[] }).otherEvents ?? []),
      ] : [];
      const regional = filterGandayaRegionalCandidates(listingEvents);
      gandayaRegionalFiltered += regional.filtered.length;
      for (const event of regional.regional) {
        const link = gandayaEventUrl(event.alias);
        if (link) discovered.add(link);
      }
    }
    if (publicSourceKey(baseUrl) === "public:articket") {
      const articketLinks = discoverArticketEventLinks(page.html, page.url, activeAliases);
      for (const link of articketLinks) {
        discovered.add(link);
        if (!options.dryRun) await upsertDiscoveredArticketSource({ url: link, name: formatArticketSourceName(link) }).catch(error => console.warn("[Articket discoverer] Could not persist discovered URL:", sanitizeFetchFailure(error).message));
      }
    }
    if (isMrIngressosCatalogUrl(baseUrl)) {
      for (const event of extractMrIngressosListingEvents(page.html, page.url)) discovered.add(event.url);
    }
    if (isBlackPassRootUrl(baseUrl)) {
      const catalog = await fetchBlackPassCatalog().catch(error => { logPublicFailureDiagnostics(baseUrl, error); return []; });
      if (catalog.length === 0) logPublicFailureDiagnostics(baseUrl, createFetchError("Adaptador Black Pass não encontrou eventos no catálogo público"));
      for (const event of catalog) if (event.id) discovered.add(blackPassEventUrl(event.id));
    }
  }
  return { urls: Array.from(discovered).filter(url => {
    try {
      const host = new URL(url).hostname;
      const belongsToSource = !options.sourceKey || options.sourceKey === "public" || publicSourceKey(url) === options.sourceKey;
      const belongsToRequestedSource = !requestedSourceUrls || requestedSourceUrls.some(requested => requested === sanitizePublicSourceUrl(url) || (isPublicCatalogUrl(requested) && publicSourceKey(requested) === publicSourceKey(url)));
      return belongsToSource && belongsToRequestedSource && (!host.endsWith("zig.tickets") || url !== "https://zig.tickets/pt-BR");
    } catch { return false; }
  }).slice(0, 120), articketRegionalFiltered: regionalArticketCandidates.filtered.length, gandayaRegionalFiltered, apifyStats };
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
  errors: Array<Pick<FetchFailure, "sourceKey" | "url" | "status" | "httpStatus" | "message" | "errorCode" | "retryable" | "attempts"> & { sourceUrl?: string }>;
  durationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  regionalFiltered?: number;
  regionalProcessed?: number;
  rejectionReasons: { fetchFailed: number; outsideTargetVenue: number; invalidStructuredEvent: number; duplicate: number; pastEvent: number };
};

export type IngestionPipelineOptions = { dryRun?: boolean; sourceKey?: string; sourceUrls?: string[]; exploratorySourceUrls?: string[]; exploratoryApify?: boolean; signal?: AbortSignal };
type PublicSourceReportInput = {
  candidateUrls: string[];
  pages: PromiseSettledResult<PublicPage>[];
  payloadEvents?: Array<Record<string, string | number | boolean>>;
  acceptedEvents?: Array<{ sourceKey: string }>;
  rejectedEvents?: Array<{ sourceKey: string; reason: "invalidStructuredEvent" | "pastEvent" }>;
  duplicateSourceKeys?: string[];
  sourceOutcomes?: Array<{ sourceKey: string; created: boolean; updated: boolean }>;
  regionalFiltered?: number;
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
      regionalFiltered: sourceKey === "public:articket" || sourceKey === "public:gandaya" ? input.regionalFiltered ?? 0 : 0,
      regionalProcessed: 0,
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
        report.errors.push({ ...failure, sourceUrl: url, url, sourceKey: publicSourceKey(url), message: formatPublicFetchFailure(failure) });
      }
      return;
    }
    const durationMs = Math.max(0, Number(page.value.durationMs ?? 0));
    report.durationMs += durationMs;
    report.latencySamples.push(durationMs);
    if (page.value.circuitOpen) {
      report.rejectionReasons.fetchFailed += 1;
        report.errors.push({ sourceUrl: url, url, sourceKey: publicSourceKey(url), status: null, httpStatus: null, errorCode: "UPSTREAM_UNAVAILABLE", retryable: true, attempts: 0, message: "Fonte pausada pelo Circuit Breaker durante o cooldown." });
    } else if (input.matchesTargetVenue && !input.matchesTargetVenue(page.value.text)) {
      report.filtered += 1;
      report.rejectionReasons.outsideTargetVenue += 1;
    } else if (page.value.cacheFallback?.used) {
        report.errors.push({ sourceUrl: url, url, sourceKey: publicSourceKey(url), status: page.value.cacheFallback.status, httpStatus: page.value.cacheFallback.status, errorCode: "UPSTREAM_UNAVAILABLE", retryable: true, attempts: 1, message: `Fallback utilizado: ${page.value.cacheFallback.message}` });
    }
    if (page.value.adapterError && !isHealthyEmptyPublicPage(page.value)) {
      report.errors.push({ sourceUrl: url, url, sourceKey: publicSourceKey(url), status: null, httpStatus: null, errorCode: "PARSE_EMPTY", retryable: false, attempts: 1, message: page.value.adapterError });
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
    regionalProcessed: report.sourceKey === "public:articket" || report.sourceKey === "public:gandaya" ? report.read : 0,
    ignored: report.filtered,
    medianDurationMs: percentile(report.latencySamples, 50),
    p95DurationMs: percentile(report.latencySamples, 95),
    latencySamples: undefined,
  })).map(({ latencySamples: _latencySamples, ...report }) => report).sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
}

export async function runIngestionPipeline(options: IngestionPipelineOptions = {}) {
  const dryRun = options.dryRun === true;
  const activeAliases = await listActiveLocationAliasValues();
  const activeBrands = await listActiveMonitoredBrands();
  const matchesTargetVenue = (value: string) => containsTargetVenue(value, activeAliases);
  const matchesTargetContent = (value: string, sourceUrl?: string) => {
    const sourceKey = sourceUrl ? publicSourceKey(sourceUrl) : options.sourceKey;
    if (sourceKey === "public:gandaya") return isGandayaRegionalCandidate({ text: value });
    return matchesPublicTarget(value, sourceKey, activeAliases, activeBrands);
  };
  const discovery = await discoverCandidatePages(options, activeAliases);
  const candidateUrls = discovery.urls;
  if (candidateUrls.length === 0) return { imported: 0, persisted: 0, dryRun, dryRunAcceptedEvents: 0, read: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, skipped: true, reason: "Nenhuma fonte de ingestão configurada", sourceReports: [] as IngestionSourceReport[], articketRegionalFiltered: discovery.articketRegionalFiltered };
  const pages = await fetchWithConcurrency(candidateUrls, url => guardedFetchPublicPage(url, options), PUBLIC_FETCH_CONCURRENCY);
  const fulfilledPages = pages
    .filter((result): result is PromiseFulfilledResult<PublicPage> => result.status === "fulfilled")
    .map(result => result.value);
  const fallbackPages = fulfilledPages.filter(page => page.cacheFallback?.used);
  const circuitOpenPages = fulfilledPages.filter(page => page.circuitOpen === true);
  const rejectedPages = pages.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  const fetchFailures = [
    ...circuitOpenPages.map(page => ({ sourceUrl: page.url, sourceKey: publicSourceKey(page.url), url: page.url, status: null, httpStatus: null, errorCode: "UPSTREAM_UNAVAILABLE" as const, retryable: true, attempts: 0, message: "Fonte pausada pelo Circuit Breaker durante o cooldown.", fallbackUsed: false })),
    ...fallbackPages.map(page => ({ sourceUrl: page.url, sourceKey: publicSourceKey(page.url), url: page.url, ...page.cacheFallback, status: page.cacheFallback?.status ?? null, httpStatus: page.cacheFallback?.status ?? null, errorCode: "UPSTREAM_UNAVAILABLE" as const, retryable: true, attempts: 1 })),
    ...rejectedPages.map((result, index) => ({ sourceUrl: candidateUrls[index], ...sanitizeFetchFailure(result.reason, { sourceKey: publicSourceKey(candidateUrls[index]), url: candidateUrls[index] }) })),
  ].map(failure => ({ ...failure, sourceUrl: String(failure.sourceUrl).slice(0, 1000), url: String(failure.url ?? failure.sourceUrl).slice(0, 1000), status: failure.status ?? null, httpStatus: failure.httpStatus ?? failure.status ?? null, message: formatPublicFetchFailure({ status: failure.status ?? null, message: String(failure.message).slice(0, 240) }), fallbackUsed: "used" in failure && failure.used === true }));
  const fetchFailed = fetchFailures.length;
  const outsideTargetVenue = fulfilledPages.filter(page => !matchesTargetContent(page.text, page.url)).length;
  const sourcePages = fulfilledPages.filter(page => matchesTargetContent(page.text, page.url));
  await Promise.all(sourcePages
    .filter(page => page.adapter === "articket" && !Array.isArray(page.structured) && typeof page.structured?.title === "string")
    .map(page => {
      const title = !Array.isArray(page.structured) ? page.structured?.title : undefined;
      if (typeof title !== "string") return { updated: false };
      return updateDiscoveredArticketSourceName({ url: page.url, title }).catch(error => {
        console.warn("[Articket parser] Could not update discovered source name:", sanitizeFetchFailure(error).message);
        return { updated: false };
      });
    }));
  const filteredByReason = { fetchFailed, outsideTargetVenue, invalidStructuredEvent: 0, pastEvent: 0, duplicate: 0 };
  const filteredSourceUrls = pages.flatMap((result, index) => result.status === "rejected" || !matchesTargetContent(result.status === "fulfilled" ? result.value.text : "", candidateUrls[index]) ? [candidateUrls[index]] : []);

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
    return { imported: 0, persisted: 0, dryRun, dryRunAcceptedEvents: 0, read: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, skipped: false, discovered: candidateUrls.length, matchedSources: 0, fallbackUsed: fallbackPages.length, fetchFailures, filteredByReason, filteredSourceUrls, reason: "Nenhum evento dos locais-alvo encontrado nas fontes públicas", sourceReports: buildPublicSourceReports({ candidateUrls, pages, regionalFiltered: discovery.articketRegionalFiltered + discovery.gandayaRegionalFiltered, matchesTargetVenue }), articketRegionalFiltered: discovery.articketRegionalFiltered, gandayaRegionalFiltered: discovery.gandayaRegionalFiltered };
  }

  const apiStructuredEvents = sourcePages.flatMap(page => {
    if (!("structured" in page) || !page.structured) return [];
    return Array.isArray(page.structured) ? page.structured : [page.structured];
  });
  const rawText = sourcePages
    .map(page => `SOURCE_URL: ${page.url}\nIMAGE_URL: ${page.imageUrl}\nCONTENT: ${page.text}`)
    .join("\n\n")
    .slice(0, 48_000);
  const monitoredBrandInstructions = activeBrands.length > 0
    ? ` Além da allowlist de locais, extraia também eventos musicais futuros publicados pelas marcas monitoradas ${activeBrands.map(brand => `${brand.name} (termos: ${brand.matchTerms.join(", ")}; cidades permitidas: ${brand.cities.join(", ")})`).join("; ")}. Para esses casos, a marca precisa estar explícita no conteúdo e a cidade deve corresponder à configuração; o local do evento pode ser diferente dos venues da allowlist.`
    : "";

  const structured = apiStructuredEvents.length > 0 ? { choices: [{ message: { content: JSON.stringify({ events: apiStructuredEvents }) } }] } : await invokeLLM({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `Extraia somente eventos públicos de música, shows ou baladas nos locais oficiais Vallum Garden, Moby Dick, Ativa House, Casa 412, Verilonguinho, Meu Lugar, Goat Club, Laroc Club Guarujá, Lucky Scope, Curvão Surf House, Guarujá Golf Club, Praia Verde Beach Club, Praia Verde, Casa Grande Hotel Resort, Casa Grande Hotel, Praiô, Flamingos, Projac Bar, Boteco Almare, Dolores Restaurante e Bar, Arena Club, Yellow House, Arena Jequitimar, Parque Valongo, Armazém 3, Blue Med Convention Center ou Santos Convention Center, localizados exclusivamente em Santos ou Guarujá. Ignore eventos passados, cidades diferentes, locais fora dessa allowlist e eventos de gastronomia, esporte, teatro ou exposição sem música. Retorne somente JSON no schema. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Se o gênero não puder ser inferido com segurança, descarte o evento. Use o SOURCE_URL correspondente como sourceUrl e IMAGE_URL quando houver.${monitoredBrandInstructions}` },
      { role: "user", content: rawText },
    ],
    response_format: { type: "json_schema", json_schema: { name: "event_batch", strict: true, schema: { type: "object", properties: { events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, eventDateEstimated: { type: "boolean" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string" }, category: { type: "string", enum: ["show", "balada", "evento_musical"] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] }, priceCents: { type: "integer" }, sourceUrl: { type: "string" }, imageUrl: { type: "string" }, latitude: { type: "string" }, longitude: { type: "string" } }, required: ["title", "summary", "eventDate", "eventDateEstimated", "locationName", "address", "city", "category", "genre", "priceCents", "sourceUrl", "imageUrl", "latitude", "longitude"], additionalProperties: false } } }, required: ["events"], additionalProperties: false } } },
  });

  const payload = JSON.parse(String(structured.choices?.[0]?.message?.content ?? "{\"events\":[]}")) as { events: Array<Record<string, string | number | boolean>> };
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
    const eventBrand = getMonitoredPublicBrand(`${String(event.title)} ${String(event.summary ?? "")} ${String(event.sourceUrl ?? "")}`, sourceKey, activeBrands);
    const brandCityMatches = Boolean(eventBrand?.cities.some(brandCity => normalizeText(brandCity) === normalizeText(city)));
    const validCity = sourceKey === "public:gandaya" ? GANDAYA_REGIONAL_CITIES.some(allowed => normalizeText(allowed) === normalizeText(city)) : city === "Santos" || city === "Guarujá";
    if (Number.isNaN(date.getTime()) || !validCity || (!matchesTargetVenue(`${locationName} ${address}`) && !brandCityMatches && sourceKey !== "public:gandaya") || !["show", "balada", "evento_musical"].includes(category) || !["funk", "house_eletronica", "samba_pagode", "rap_trap"].includes(genre)) {
      filteredByReason.invalidStructuredEvent += 1;
      rejectedEvents.push({ sourceKey, reason: "invalidStructuredEvent" });
      continue;
    }
    try { assertEventDateIsCurrentOrFuture(date, new Date(), String(event.title)); } catch { filteredByReason.pastEvent += 1; rejectedEvents.push({ sourceKey, reason: "pastEvent" }); continue; }
    const sourceUrl = String(event.sourceUrl);
    const fuzzyDuplicate = acceptedEvents.some(previous => areFuzzyDuplicateEvents(previous, { title: String(event.title), eventDate: date, city }));
    if (fuzzyDuplicate) { duplicates += 1; duplicateSourceKeys.push(sourceKey); continue; }
    acceptedEvents.push({ title: String(event.title), eventDate: date, city, sourceKey });
    const sourceHash = buildPublicEventIdentity(sourceKey, String(event.title), date, sourceUrl, activeBrands);
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
    const eventDateEstimated = event.eventDateEstimated === true;
    const saved = await saveEvent({ title: String(event.title), slug: `${normalizeSlug(String(event.title))}-${date.getTime()}`, description: String(event.summary), eventDate: date, locationName: String(event.locationName), address: String(event.address), city, category: category as "show" | "balada" | "evento_musical", genre, priceCents: Number(event.priceCents) || 0, priceNote: event.priceNote === undefined ? undefined : String(event.priceNote).slice(0, 255), sourceUrl, sourceType, imageUrl: String(event.imageUrl || ""), latitude, longitude, sourceHash, isPublished: eventDateEstimated ? 0 : 1, isArchived: 0 });
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
      const brand = getTrackedPublicBrand(`${String(event.title)} ${String(event.sourceUrl ?? "")}`, sourceKey, activeBrands);
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
  const sourceReports = buildPublicSourceReports({ candidateUrls, pages, payloadEvents: payload.events, acceptedEvents, rejectedEvents, duplicateSourceKeys, sourceOutcomes, regionalFiltered: discovery.articketRegionalFiltered + discovery.gandayaRegionalFiltered, matchesTargetVenue });
  const persistedCount = simulation ? 0 : added + updated;
  const contentFiltered = filteredByReason.invalidStructuredEvent + filteredByReason.pastEvent;
  const read = simulation ? 0 : persistedCount + contentFiltered + duplicates;
  const ignored = contentFiltered + duplicates;
  return { imported, persisted: persistedCount, added: simulation ? 0 : added, updated: simulation ? 0 : updated, ignored, dryRun: simulation, dryRunAcceptedEvents, read, filtered: contentFiltered, duplicates, missingCoordinates, outOfBoundsCoordinates, skipped: false, discovered: candidateUrls.length, matchedSources: sourcePages.length, fallbackUsed: fallbackPages.length, fetchFailures, filteredByReason, filteredSourceUrls, sourceReports, articketRegionalFiltered: discovery.articketRegionalFiltered, gandayaRegionalFiltered: discovery.gandayaRegionalFiltered };
}
