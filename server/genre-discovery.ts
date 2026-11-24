import { and, asc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { discoveredEventCandidates, events, ingestionSources } from "../drizzle/schema";
import { normalizeDiscoveredSourceUrl } from "../shared/source-url";
import { sanitizeEventText } from "../shared/event-text";
import { guardedFetchPublicPage, discoverCandidatePages, publicSourceKey, type PublicPage } from "./ingestion";
import { getDb, saveEvent } from "./db";

export const DISCOVERY_GENRES = ["trap", "rap", "funk", "eletrônica"] as const;
export type DiscoveryGenre = typeof DISCOVERY_GENRES[number];
export const DISCOVERY_CITIES = ["Santos", "Guarujá"] as const;
export type DiscoveryCity = typeof DISCOVERY_CITIES[number];
export type DiscoveryStatus = "pending" | "approved" | "rejected";
export const DISCOVERY_REGIONAL_SOURCE_URLS = [
  "https://www.sympla.com.br/eventos/santos-sp",
  "https://www.sympla.com.br/eventos/guaruja-sp",
  "https://www.ingresse.com/search?query=santos",
  "https://www.ingresse.com/search?query=guaruja",
  "https://zig.tickets/pt-BR?city=santos",
  "https://zig.tickets/pt-BR?city=guaruja",
  "https://blacktag.com.br/?city=santos",
  "https://blacktag.com.br/?city=guaruja",
  "https://articket.com.br/?city=santos",
  "https://articket.com.br/?city=guaruja",
  "https://blackpass.com.br/?city=santos",
  "https://blackpass.com.br/?city=guaruja",
  "https://gandaya.dance/?city=santos",
  "https://gandaya.dance/?city=guaruja",
  "https://mringressos.com.br/?cidade=santos",
  "https://mringressos.com.br/?cidade=guaruja",
  "https://www.weticket.com.br/?city=santos",
  "https://www.weticket.com.br/?city=guaruja",
  "https://www.ticket360.com.br/eventos/santos",
  "https://www.ticket360.com.br/eventos/guaruja",
] as const;

const GENRE_TERMS: Record<DiscoveryGenre, RegExp> = {
  trap: /\btrap\b/i,
  rap: /\brap\b|hip[ -]?hop/i,
  funk: /\bfunk\b|baile funk/i,
  "eletrônica": /m[uú]sica\s+eletr[oô]nica|\b(?:tech\s*house|deep\s*house|house|techno|trance|psytrance|progressive|edm|after)\b|\bsunset\s+eletr[oô]nico|\b(?:line[- ]?up|lineup)\b[^.!?]{0,100}\b(?:dj|djs)\b/i,
};
const DISCOVERY_CITY_PATTERNS: Array<[DiscoveryCity, RegExp]> = [
  ["Guarujá", /guaruj[aá]/i],
  ["Santos", /santos/i],
];
const OUT_OF_SCOPE_CITY_PATTERNS = [
  /praia\s+grande/i,
  /s[aã]o\s+vicente/i,
  /cubat[aã]o/i,
  /curitiba|\bcwb\b/i,
  /sorocaba/i,
  /bauru/i,
  /mogi(?:\s+das\s+cruzes|\s+mirim|\s+mogiano)?/i,
  /bel[eé]m/i,
  /s[aã]o\s+paulo/i,
  /rio\s+de\s+janeiro|\brio\b/i,
];
const ADMINISTRATIVE_ELECTRONIC_TERMS = /ingressos?\s+eletr[oô]nicos?|ingresso\s+eletr[oô]nico|bilhete\s+eletr[oô]nico|documento\s+eletr[oô]nico|pagamento\s+eletr[oô]nico|meia[- ]entrada\s+eletr[oô]nica/gi;

export function classifyDiscoveryGenres(input: { title?: string; subtitle?: string; lineup?: string; description?: string; tags?: string[] } | string): DiscoveryGenre[] {
  const text = typeof input === "string" ? input : [input.title, input.subtitle, input.lineup, input.description, ...(input.tags ?? [])].filter(Boolean).join(" ");
  const searchable = text.replace(ADMINISTRATIVE_ELECTRONIC_TERMS, " ");
  return DISCOVERY_GENRES.filter(genre => GENRE_TERMS[genre].test(searchable));
}

export function detectDiscoveryCity(text: string): DiscoveryCity | undefined {
  return DISCOVERY_CITY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
}

function hasOutOfScopeCity(text: string) {
  return OUT_OF_SCOPE_CITY_PATTERNS.some(pattern => pattern.test(text));
}

function readStructuredLocation(record: Record<string, unknown>) {
  const location = record.location && typeof record.location === "object" ? record.location as Record<string, unknown> : {};
  const address = record.address && typeof record.address === "object" ? record.address as Record<string, unknown> : {};
  const locationAddress = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  return [
    record.city,
    record.addressLocality,
    address.city,
    address.addressLocality,
    location.city,
    location.addressLocality,
    locationAddress.city,
    locationAddress.addressLocality,
    record.locationName,
    record.venue,
    record.venueName,
    location.name,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ");
}

export function isFutureDiscoveryDate(value: Date | string | undefined, now = new Date()) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() >= now.getTime();
}

export function candidateUrl(value: string) {
  return normalizeDiscoveredSourceUrl(value) ?? "";
}

export function filterDiscoveryCandidateUrls(urls: string[], existingEventUrls: ReadonlySet<string>, existingCandidateUrls: ReadonlySet<string>) {
  return Array.from(new Set(urls.map(candidateUrl).filter(Boolean))).filter(canonical => !existingEventUrls.has(canonical) && !existingCandidateUrls.has(canonical));
}

export function pageToDiscoveryCandidate(page: Pick<PublicPage, "url" | "text" | "imageUrl" | "structured">, now = new Date()) {
  const structured = Array.isArray(page.structured) ? page.structured[0] : page.structured;
  const record = (structured ?? {}) as Record<string, unknown>;
  const structuredText = Object.values(record).filter(value => typeof value === "string").join(" ");
  const searchable = `${page.text} ${structuredText}`.replace(/\s+/g, " ").trim();
  const title = String(record.title ?? record.name ?? searchable.split(/[|\n·]/)[0] ?? "").trim().slice(0, 255);
  const rawDate = String(record.eventDate ?? record.startDate ?? "").trim();
  const eventDate = rawDate ? new Date(rawDate) : undefined;
  // Never use the complete visible page for geography: ticketing footers and
  // breadcrumbs commonly mention Santos even when the event is elsewhere.
  const locationSignals = `${readStructuredLocation(record)} ${title}`;
  const city = hasOutOfScopeCity(`${title} ${locationSignals}`) ? undefined : detectDiscoveryCity(locationSignals);
  const matchedGenres = classifyDiscoveryGenres({ title, description: searchable });
  const canonicalUrl = candidateUrl(page.url);
  if (!canonicalUrl || !title || !city || !isFutureDiscoveryDate(eventDate, now) || matchedGenres.length === 0) return undefined;
  return {
    canonicalUrl,
    platform: publicSourceKey(page.url),
    title: sanitizeEventText(title).slice(0, 255),
    eventDate: eventDate!,
    city,
    venueNameRaw: String(record.locationName ?? record.venue ?? record.venueName ?? "").trim().slice(0, 255) || null,
    matchedGenres,
    flyerUrl: page.imageUrl?.trim() || null,
    description: sanitizeEventText(searchable).slice(0, 12000) || null,
  };
}

export type GenreDiscoveryScanResult = {
  scannedPages: number;
  eligible: number;
  inserted: number;
  duplicates: number;
  filtered: number;
  errors: number;
};

export async function runGenreDiscoveryScan(options: { now?: Date; sourceUrls?: string[] } = {}): Promise<GenreDiscoveryScanResult> {
  const now = options.now ?? new Date();
  const discovery = await discoverCandidatePages({ dryRun: true, sourceUrls: options.sourceUrls, exploratorySourceUrls: [...DISCOVERY_REGIONAL_SOURCE_URLS] });
  const urls = discovery.urls.map(candidateUrl).filter(Boolean);
  const pages = await Promise.allSettled(urls.map(url => guardedFetchPublicPage(url, { dryRun: true })));
  const result: GenreDiscoveryScanResult = { scannedPages: pages.length, eligible: 0, inserted: 0, duplicates: 0, filtered: 0, errors: 0 };
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existingEvents = await db.select({ sourceUrl: events.sourceUrl }).from(events).where(isNotNull(events.sourceUrl));
  const existingEventUrls = new Set(existingEvents.map(row => candidateUrl(row.sourceUrl ?? "")));
  const existingCandidates = await db.select({ canonicalUrl: discoveredEventCandidates.canonicalUrl }).from(discoveredEventCandidates);
  const knownCandidates = new Set(existingCandidates.map(row => candidateUrl(row.canonicalUrl)));
  const candidateUrls = filterDiscoveryCandidateUrls(urls, existingEventUrls, knownCandidates);
  for (let index = 0; index < pages.length; index += 1) {
    const settled = pages[index];
    if (settled.status === "rejected") { result.errors += 1; continue; }
    const page = settled.value;
    const normalizedUrl = candidateUrl(page.url);
    if (!candidateUrls.includes(normalizedUrl) || existingEventUrls.has(normalizedUrl) || knownCandidates.has(normalizedUrl)) { result.duplicates += 1; continue; }
    const candidate = pageToDiscoveryCandidate(page, now);
    if (!candidate) { result.filtered += 1; continue; }
    result.eligible += 1;
    const inserted = await db.insert(discoveredEventCandidates).values(candidate).onConflictDoNothing({ target: discoveredEventCandidates.canonicalUrl }).returning({ id: discoveredEventCandidates.id });
    if (inserted.length > 0) { result.inserted += 1; knownCandidates.add(normalizedUrl); }
    else result.duplicates += 1;
  }
  return result;
}

export async function listGenreDiscoveryCandidates(input: { status?: DiscoveryStatus; genre?: DiscoveryGenre; city?: DiscoveryCity; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const conditions = [];
  if (input.status) conditions.push(eq(discoveredEventCandidates.status, input.status));
  if (input.city) conditions.push(eq(discoveredEventCandidates.city, input.city));
  if (input.genre) conditions.push(sql`${input.genre} = ANY(${discoveredEventCandidates.matchedGenres})`);
  return db.select().from(discoveredEventCandidates).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(discoveredEventCandidates.eventDate), asc(discoveredEventCandidates.id)).limit(Math.min(200, Math.max(1, input.limit ?? 50))).offset(Math.max(0, input.offset ?? 0));
}

export async function rejectGenreDiscoveryCandidate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [row] = await db.update(discoveredEventCandidates).set({ status: "rejected", reviewedAt: new Date() }).where(eq(discoveredEventCandidates.id, id)).returning();
  return row;
}

export async function approveGenreDiscoveryCandidate(id: number, addAsSource = false) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [candidate] = await db.select().from(discoveredEventCandidates).where(eq(discoveredEventCandidates.id, id)).limit(1);
  if (!candidate) return undefined;
  if (candidate.status === "rejected") throw new Error("Candidato descartado não pode ser aprovado");
  const category = candidate.matchedGenres.includes("funk") || candidate.matchedGenres.includes("eletrônica") ? "balada" : "evento_musical";
  const genre = candidate.matchedGenres.includes("funk") ? "funk" : candidate.matchedGenres.includes("eletrônica") ? "house_eletronica" : "rap_trap";
  const saved = await saveEvent({ title: candidate.title, slug: `${candidate.platform}-${candidate.id}-${candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150)}`, description: candidate.description, eventDate: candidate.eventDate, locationName: candidate.venueNameRaw || candidate.city, address: null, neighborhood: null, formattedAddress: null, city: candidate.city, category, genre, priceCents: 0, priceNote: null, ticketStatus: "unknown", sourceUrl: candidate.canonicalUrl, sourceType: candidate.platform, imageUrl: candidate.flyerUrl, latitude: null, longitude: null, locationPrecision: "approximate", sourceHash: null, isPublished: 1, isArchived: 0 });
  if (addAsSource) {
    await db.insert(ingestionSources).values({ sourceKey: `discovery:${candidate.platform}:${candidate.id}`, name: candidate.title, kind: "public", url: candidate.canonicalUrl, isEnabled: 1 }).onConflictDoNothing({ target: ingestionSources.sourceKey });
  }
  const [updated] = await db.update(discoveredEventCandidates).set({ status: "approved", reviewedAt: new Date() }).where(eq(discoveredEventCandidates.id, id)).returning();
  return { candidate: updated, eventId: saved.id, created: saved.created, addAsSource };
}
