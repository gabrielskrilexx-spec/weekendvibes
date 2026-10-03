import crypto from "node:crypto";
import { INSTAGRAM_AGENDA_SOURCE_TYPE, claimApifyDailyRequest, listActiveLocationAliasValues, listEnabledInstagramSources, markIngestionSourceResult, recordOperationalAlert, saveEvent } from "./db.js";
import { fetchExternal, isSandboxRestrictedError, readExternalBody } from "./external-fetch.js";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings.js";
import { containsTargetVenue } from "./ingestion.js";
import { parseMetaBusinessDiscovery } from "./contracts/external.js";
import { resolveRegionalCoordinates } from "./geocoding.js";
import { allowSourceAttempt, registerSourceFailure, registerSourceSuccess } from "./circuit-breaker.js";
import { persistManualReviewEvents, type ManualReviewEventInput } from "./manual-review.js";

const META_GRAPH_BASE_URL = "https://graph.facebook.com/v26.0";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const LOOKBACK_DAYS = 5;
export function getInstagramSaoPauloDate(now = new Date()) {
  return saoPauloCalendarDate(now);
}

export function getInstagramReferenceDate(now = new Date()) {
  return getInstagramSaoPauloDate(now);
}

export function isInstagramReferenceDateAligned(referenceDate: string, now = new Date()) {
  return getInstagramSaoPauloDate(now) === referenceDate;
}

export async function recordReferenceDateClockAlert(referenceDate: string, now = new Date()) {
  const systemDate = getInstagramSaoPauloDate(now);
  if (systemDate === referenceDate) return true;
  await recordOperationalAlert({
    integration: "pipeline",
    alertType: "reference_date_clock_desync",
    severity: "CRITICAL",
    title: "Desalinhamento da data de referência do Instagram",
    message: `Data de referência ${referenceDate} diverge da data do sistema em America/Sao_Paulo (${systemDate}).`,
  });
  return false;
}

export type InstagramIntegration = "meta" | "ocr" | "openai";

/** Marcadores de praça usados pelos estabelecimentos da Baixada Santista. */
export const REGIONAL_HASHTAGS = ["#Guarujá", "#Santos"] as const;

/** Origem da mídia, preparada para um futuro conector oficial de Stories. */
export type InstagramMediaOrigin = "post" | "story" | "highlight";

export class InstagramIntegrationFailure extends Error {
  constructor(public readonly integration: InstagramIntegration, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InstagramIntegrationFailure";
  }
}

/** Extrai somente o status HTTP da mensagem redigida do upstream Meta. */
export function getMetaFailureStatus(error: unknown) {
  if (!(error instanceof InstagramIntegrationFailure) || error.integration !== "meta") return null;
  const match = error.message.match(/HTTP (\d{3})/i);
  return match ? Number(match[1]) : null;
}

/** Falhas conhecidas do upstream podem degradar para agenda vazia sem dados forjados. */
export function isGracefullyDegradedMetaFailure(error: unknown) {
  const status = getMetaFailureStatus(error);
  return status !== null && [401, 403, 408, 429, 500, 502, 503, 504].includes(status);
}

let instagramSessionGeneration = 0;

/**
 * Business Discovery uses the official Graph API and does not maintain a
 * browser/proxy session. This generation invalidates any request context used
 * by a retry without attempting to bypass Meta controls or rotate IPs.
 */
export function resetInstagramSessionForRetry(reason: string) {
  instagramSessionGeneration += 1;
  console.warn("[Instagram] request context invalidated for next retry", { reason: normalizeDiagnosticText(reason, 80), sessionGeneration: instagramSessionGeneration });
  return instagramSessionGeneration;
}

export function getInstagramSessionGeneration() {
  return instagramSessionGeneration;
}

export function isInstagramTransportFailure(status: number, body = "") {
  return [401, 403, 502].includes(status) || /invalid proxy response|proxy response|session|forbidden|authentication/i.test(body);
}

/** OAuthException/invalid-token responses are isolated to Meta so Apify can still run. */
export function isMetaCredentialFailure(status: number, body = "") {
  return status === 401 || (status === 400 && /oauthexception|invalid oauth|access token|expired|token.*invalid|session.*expired/i.test(body));
}

export const INSTAGRAM_TARGETS = [
  { name: "Moby House", username: "mobydicksantos", directUrl: "https://www.instagram.com/mobydicksantos/" },
  { name: "Projac Bar", username: "projac.bar", directUrl: "https://www.instagram.com/projac.bar/" },
  { name: "Meu Lugar Bar e Entretenimento", username: "meulugar.bar", directUrl: "https://www.instagram.com/meulugar.bar/" },
  { name: "Nosso After", username: "nossoafterguaruja", directUrl: "https://www.instagram.com/nossoafterguaruja/" },
  { name: "Curvão Surf House", username: "curvaosurfhouse", directUrl: "https://www.instagram.com/curvaosurfhouse/" },
  { name: "Flamingo Bar", username: "flamingomusicbar", directUrl: "https://www.instagram.com/flamingomusicbar/" },
  { name: "Rocket Sea Club", username: "rocketseaclub", directUrl: "https://www.instagram.com/rocketseaclub/" },
  { name: "Ativa House", username: "ativahouse", directUrl: "https://www.instagram.com/ativahouse/" },
  { name: "Mimada Festa", username: "mimadafesta", directUrl: "https://www.instagram.com/mimadafesta/" },
] as const;

export type InstagramPost = {
  id?: string;
  shortCode?: string;
  url?: string;
  permalink?: string;
  caption?: string;
  text?: string;
  timestamp?: string | number;
  takenAt?: string | number;
  postedAt?: string | number;
  expiresAt?: string | number;
  displayUrl?: string;
  imageUrl?: string;
  media_url?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  isVideo?: boolean;
  ownerUsername?: string;
  username?: string;
  sourceKey?: string;
  mediaType?: InstagramMediaOrigin;
  highlightTitle?: string;
  ocrText?: string;
};

export type InstagramOcrAuditItem = {
  mediaOrigin: InstagramMediaOrigin;
  imageUrl: string;
  sourceUrl: string;
  highlightTitle: string | null;
  ocrText: string;
  rawText: string;
};

export function buildOcrAuditEntries(posts: Array<{ post: InstagramPost; rawText: string }>): InstagramOcrAuditItem[] {
  return posts.slice(0, 25).map(({ post, rawText }) => ({
    mediaOrigin: post.mediaType ?? "post",
    imageUrl: String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? "").slice(0, 1000),
    sourceUrl: postUrl(post).slice(0, 1000),
    highlightTitle: post.highlightTitle ? String(post.highlightTitle).slice(0, 160) : null,
    ocrText: String(post.ocrText ?? "").slice(0, 3000),
    rawText: rawText.slice(0, 5000),
  })).filter(item => item.imageUrl.startsWith("https://") || item.ocrText.length > 0 || item.rawText.length > 0);
}

export const INSTAGRAM_AGENDA_TITLE_REGEX = /programa(?:ção|cao)|agenda/i;

export function isAgendaHighlightTitle(title: unknown) {
  return INSTAGRAM_AGENDA_TITLE_REGEX.test(String(title ?? "").normalize("NFC"));
}

export function buildInstagramScraperPayload(targets: ReadonlyArray<{ username: string; directUrl: string }>) {
  return {
    directUrls: targets.map(target => target.directUrl),
    usernames: targets.map(target => target.username),
    resultsType: "details",
    resultsLimit: 25,
    stories: true,
    highlights: true,
    includeStories: true,
    includeHighlights: true,
  } as const;
}

/** Input contract for the dedicated Stories Actor; kept separate from the profile/posts Actor contract. */
export const DEFAULT_APIFY_ACTOR_MAX_RUNTIME_SECS = 45;
export function getApifyActorMaxRuntimeSecs() {
  const configured = Number.parseInt(process.env.APIFY_ACTOR_MAX_RUNTIME_SECS ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_APIFY_ACTOR_MAX_RUNTIME_SECS;
  return Math.min(60, Math.max(20, configured));
}

export function buildInstagramStoriesScraperPayload(targets: ReadonlyArray<{ username: string }>) {
  return {
    targets: targets.map(target => target.username),
    scrapeType: "both" as const,
    maxHighlights: 2,
    onlyNew: true,
  } as const;
}

export function limitInstagramStoriesForCost(posts: InstagramPost[], now = new Date()) {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const highlightCount = new Map<string, number>();
  const sorted = [...posts].sort((a, b) => (postDate(b)?.getTime() ?? 0) - (postDate(a)?.getTime() ?? 0));
  return sorted.filter(post => {
    const handle = String(post.ownerUsername ?? post.username ?? "").replace(/^@/, "").toLowerCase();
    if (post.mediaType === "highlight") {
      const count = highlightCount.get(handle) ?? 0;
      if (count >= 2) return false;
      highlightCount.set(handle, count + 1);
      return true;
    }
    if (post.mediaType !== "story") return false;
    const takenAt = postDate(post)?.getTime();
    return typeof takenAt === "number" && takenAt >= cutoff && takenAt <= now.getTime();
  });
}

export function normalizeInstagramMediaItem(item: Record<string, unknown>, fallbackUsername = ""): InstagramPost | null {
  const rawType = [item.item_type, item.type, item.mediaType, item.productType].find(value => String(value ?? "").toLowerCase().includes("story"))
    ?? [item.item_type, item.type, item.mediaType, item.productType].find(value => String(value ?? "").toLowerCase().includes("highlight"))
    ?? item.mediaType ?? item.item_type ?? item.type ?? item.productType ?? "post";
  const mediaType = String(rawType).toLowerCase();
  const normalizedType: InstagramMediaOrigin = mediaType.includes("highlight") ? "highlight" : mediaType.includes("story") ? "story" : "post";
  const isVideo = mediaType.includes("video") || mediaType.includes("reel") || String(item.media_type ?? "").toLowerCase().includes("video") || item.isVideo === true;
  const mediaUrl = String(item.mediaUrl ?? item.media_url ?? item.displayUrl ?? item.display_url ?? item.imageUrl ?? item.image_url ?? item.image_url ?? item.videoUrl ?? item.video_url ?? item.url ?? "");
  const thumbnailUrl = String(item.thumbnailUrl ?? item.thumbnail_url ?? item.imageUrl ?? item.image_url ?? "");
  const imageUrl = isVideo ? (thumbnailUrl || mediaUrl) : mediaUrl;
  const owner = item.owner && typeof item.owner === "object" ? item.owner as Record<string, unknown> : undefined;
  const highlight = item.highlight && typeof item.highlight === "object" ? item.highlight as Record<string, unknown> : undefined;
  const username = String(item.source_username ?? item.ownerUsername ?? item.username ?? owner?.username ?? fallbackUsername);
  const highlightTitle = String(item.highlightTitle ?? item.highlight_title ?? highlight?.title ?? item.title ?? "");
  if (!imageUrl && !item.caption && !item.text) return null;
  if (normalizedType === "highlight" && !isAgendaHighlightTitle(highlightTitle)) return null;
  const providerId = item.id ?? item.media_id;
  const providerShortCode = item.shortCode ?? item.short_code;
  return {
    id: providerId !== undefined && providerId !== null && String(providerId) !== "" ? String(providerId) : undefined,
    shortCode: providerShortCode !== undefined && providerShortCode !== null && String(providerShortCode) !== "" ? String(providerShortCode) : undefined,
    url: item.url ? String(item.url) : username ? `https://www.instagram.com/${username.replace(/^@/, "")}/` : undefined,
    permalink: item.permalink ? String(item.permalink) : undefined,
    caption: item.caption ? String(item.caption) : undefined,
    text: item.text ? String(item.text) : undefined,
    timestamp: typeof (item.timestamp ?? item.postedAt ?? item.taken_at) === "number" || typeof (item.timestamp ?? item.postedAt ?? item.taken_at) === "string" ? (item.timestamp ?? item.postedAt ?? item.taken_at) as string | number : undefined,
    takenAt: typeof (item.takenAt ?? item.taken_at) === "number" || typeof (item.takenAt ?? item.taken_at) === "string" ? (item.takenAt ?? item.taken_at) as string | number : undefined,
    postedAt: typeof (item.postedAt ?? item.taken_at) === "number" || typeof (item.postedAt ?? item.taken_at) === "string" ? (item.postedAt ?? item.taken_at) as string | number : undefined,
    expiresAt: typeof (item.expiresAt ?? item.expiring_at) === "number" || typeof (item.expiresAt ?? item.expiring_at) === "string" ? (item.expiresAt ?? item.expiring_at) as string | number : undefined,
    displayUrl: imageUrl || undefined,
    imageUrl: imageUrl || undefined,
    thumbnailUrl: thumbnailUrl || undefined,
    thumbnail_url: thumbnailUrl || undefined,
    isVideo,
    ownerUsername: username || undefined,
    username: username || undefined,
    sourceKey: item.sourceKey ? String(item.sourceKey) : undefined,
    mediaType: normalizedType,
    highlightTitle: highlightTitle || undefined,
    ocrText: item.ocrText ? String(item.ocrText) : item.accessibility_caption ? String(item.accessibility_caption) : undefined,
  };
}

type MediaNormalizationContext = { username?: string; mediaType?: InstagramMediaOrigin; highlightTitle?: string };

function mediaTypeFromKey(key: string): InstagramMediaOrigin | undefined {
  const normalized = key.toLowerCase();
  if (normalized.includes("highlight")) return "highlight";
  if (normalized.includes("stor")) return "story";
  return undefined;
}

function collectInstagramMediaCandidates(value: unknown, context: MediaNormalizationContext = {}, depth = 0): InstagramPost[] {
  if (depth > 8 || value == null) return [];
  if (Array.isArray(value)) return value.flatMap(item => collectInstagramMediaCandidates(item, context, depth + 1));
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const owner = record.owner && typeof record.owner === "object" ? record.owner as Record<string, unknown> : undefined;
  const highlight = record.highlight && typeof record.highlight === "object" ? record.highlight as Record<string, unknown> : undefined;
  const username = String(record.ownerUsername ?? record.username ?? owner?.username ?? context.username ?? "");
  const highlightTitle = String(record.highlightTitle ?? highlight?.title ?? context.highlightTitle ?? "");
  const rawExplicitType = [record.type, record.mediaType, record.productType].find(value => String(value ?? "").toLowerCase().includes("story"))
    ?? [record.type, record.mediaType, record.productType].find(value => String(value ?? "").toLowerCase().includes("highlight"))
    ?? record.mediaType ?? record.type ?? record.productType ?? "";
  const explicitType = String(rawExplicitType).toLowerCase();
  const mediaType: InstagramMediaOrigin = explicitType.includes("highlight") ? "highlight" : explicitType.includes("story") ? "story" : context.mediaType ?? "post";
  const isVideo = explicitType.includes("video") || explicitType.includes("reel") || record.isVideo === true;
  const preferredMediaUrl = isVideo
    ? record.thumbnailUrl ?? record.thumbnail_url ?? record.mediaUrl ?? record.media_url
    : record.mediaUrl ?? record.media_url ?? record.displayUrl ?? record.display_url ?? record.imageUrl ?? record.image_url ?? record.thumbnailUrl ?? record.thumbnail_url;
  const normalizedRecord: Record<string, unknown> = {
    ...record,
    ownerUsername: username || undefined,
    mediaType,
    highlightTitle: highlightTitle || undefined,
    displayUrl: isVideo ? preferredMediaUrl : record.displayUrl ?? record.display_url ?? record.imageUrl ?? record.image_url ?? preferredMediaUrl,
    imageUrl: isVideo ? preferredMediaUrl : record.imageUrl ?? record.image_url ?? record.displayUrl ?? record.display_url ?? preferredMediaUrl,
    url: record.url ?? record.permalink ?? record.sourceUrl,
  };
  const direct = normalizeInstagramMediaItem(normalizedRecord, username);
  const children: InstagramPost[] = [];
  for (const [key, child] of Object.entries(record)) {
    if (["owner", "highlight"].includes(key) || child === value) continue;
    const childType = mediaTypeFromKey(key);
    children.push(...collectInstagramMediaCandidates(child, { username, mediaType: childType ?? mediaType, highlightTitle: highlightTitle || undefined }, depth + 1));
  }
  return [...(direct ? [direct] : []), ...children];
}

export function normalizeInstagramMediaPayload(payload: unknown, fallbackUsername = ""): InstagramPost[] {
  const normalized = collectInstagramMediaCandidates(payload, { username: fallbackUsername });
  const seen = new Set<string>();
  return normalized.filter(item => {
    const canonicalUrl = postUrl(item);
    const key = item.id ?? (canonicalUrl || `${item.ownerUsername ?? item.username ?? fallbackUsername}|${item.timestamp ?? item.takenAt ?? item.displayUrl ?? item.imageUrl ?? "unknown"}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type StructuredEvent = {
  title: string;
  summary: string;
  eventDate: string;
  locationName: string;
  address: string;
  city: "Santos" | "Guarujá";
  category: "show" | "balada" | "evento_musical";
  genre: "funk" | "house_eletronica" | "samba_pagode" | "rap_trap";
  priceCents: number;
  imageUrl: string;
  sourceUrl: string;
};

export type StructuredRejectionReason = "invalid_date" | "past_event" | "outside_target_venue" | "invalid_source_url" | "missing_required_field" | "invalid_category" | "invalid_genre";

export type StructuredEventRejection = {
  index: number;
  eventKey: string;
  sourceUrl: string;
  reasons: StructuredRejectionReason[];
  sourceUrlValid: boolean;
  eventDateValid: boolean;
  venueNormalized: string;
  cityNormalized: string;
  eventDateIso: string | null;
};

export type FilteredInstagramStory = {
  id: string;
  username: string;
  mediaOrigin: "story" | "highlight";
  imageUrl: string;
  sourceUrl: string;
  postedAt: string | null;
  expiresAt: string | null;
  ocrText: string;
  rawText: string;
  reasons: string[];
  status: "pending" | "approved";
};

const ALLOWED_CITIES = new Set(["Santos", "Guarujá"]);
const ALLOWED_CATEGORIES = new Set(["show", "balada", "evento_musical"]);
const ALLOWED_GENRES = new Set(["funk", "house_eletronica", "samba_pagode", "rap_trap"]);

function eventDiagnosticKey(event: Partial<StructuredEvent>, index: number) {
  return crypto.createHash("sha256").update(`${event.sourceUrl ?? ""}|${event.eventDate ?? ""}|${event.title ?? ""}|${index}`).digest("hex").slice(0, 16);
}

function normalizeDiagnosticText(value: unknown, maxLength = 120) {
  return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizedEventDateIso(value: unknown) {
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function saoPauloCalendarDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function eventCalendarDate(value: unknown, parsed: Date) {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : saoPauloCalendarDate(parsed);
}

export function normalizeStructuredEventDate(value: string) {
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00-03:00`);
  return new Date(raw);
}

export function createStructuredEventRejection(event: Partial<StructuredEvent>, index: number, reasons: StructuredRejectionReason[]): StructuredEventRejection {
  return {
    index,
    eventKey: eventDiagnosticKey(event, index),
    sourceUrl: normalizeDiagnosticText(event.sourceUrl, 1000),
    reasons,
    sourceUrlValid: reasons.includes("invalid_source_url") === false,
    eventDateValid: reasons.includes("invalid_date") === false && reasons.includes("past_event") === false,
    venueNormalized: normalizeDiagnosticText(event.locationName),
    cityNormalized: normalizeDiagnosticText(event.city),
    eventDateIso: normalizedEventDateIso(event.eventDate),
  };
}

export function validateStructuredInstagramEvent(event: Partial<StructuredEvent>, activeAliases: string[] = [], now = new Date()): StructuredRejectionReason[] {
  const reasons: StructuredRejectionReason[] = [];
  const requiredFields = [event.title, event.summary, event.eventDate, event.locationName, event.address, event.city, event.category, event.genre, event.sourceUrl];
  if (requiredFields.some(value => typeof value !== "string" || value.trim().length === 0)) reasons.push("missing_required_field");
  const parsedDate = new Date(String(event.eventDate ?? ""));
  if (Number.isNaN(parsedDate.getTime())) reasons.push("invalid_date");
  else if (eventCalendarDate(event.eventDate, parsedDate) < saoPauloCalendarDate(now)) reasons.push("past_event");
  if (!ALLOWED_CITIES.has(String(event.city))) reasons.push("outside_target_venue");
  if (!containsTargetVenue(`${String(event.locationName ?? "")} ${String(event.address ?? "")}`, activeAliases)) reasons.push("outside_target_venue");
  if (typeof event.sourceUrl !== "string" || !isValidInstagramSourceUrl(event.sourceUrl)) reasons.push("invalid_source_url");
  if (!ALLOWED_CATEGORIES.has(String(event.category))) reasons.push("invalid_category");
  if (!ALLOWED_GENRES.has(String(event.genre))) reasons.push("invalid_genre");
  return Array.from(new Set(reasons));
}

export function summarizeStructuredRejections(rejections: StructuredEventRejection[]) {
  return rejections.reduce<Record<string, number>>((summary, rejection) => {
    for (const reason of rejection.reasons) summary[reason] = (summary[reason] ?? 0) + 1;
    return summary;
  }, {});
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function postDate(post: InstagramPost) {
  const value = post.timestamp ?? post.takenAt;
  if (typeof value === "number") return new Date(value > 10_000_000_000 ? value : value * 1000);
  return value ? new Date(value) : null;
}

export function isWithinInstagramLookback(post: InstagramPost, now = new Date()) {
  const date = postDate(post);
  if (!date || Number.isNaN(date.getTime())) return false;
  const cutoff = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return date >= cutoff && date <= now;
}

export function hasRegionalHashtag(text: string) {
  return REGIONAL_HASHTAGS.some(hashtag => text.includes(hashtag));
}

function normalizeAgendaText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Gate inicial deliberadamente permissivo: a OpenAI é a autoridade para
 * classificar relevância, data, cidade e gênero do evento.
 */
export function hasApprovedAgendaText(text: string, _username?: string) {
  return normalizeAgendaText(text).trim().length > 0;
}

function isValidInstagramSourceUrl(value: string) {
  return /^https:\/\/www\.instagram\.com\/(?:p|reel|tv|stories|s)\/[A-Za-z0-9._-]+\/?$/i.test(value)
    || /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/?$/i.test(value);
}

function postUrl(post: InstagramPost) {
  const candidate = post.url ?? post.permalink;
  if (candidate?.startsWith("https://www.instagram.com/")) return candidate;
  if (post.shortCode) return `https://www.instagram.com/p/${post.shortCode}/`;
  return "";
}

const OPENAI_RETRY_DELAYS_MS = [250, 750];

export async function waitForOpenAiRetry(delayMs: number) {
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

async function openAiChat(body: Record<string, unknown>) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${requiredEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
    const responseText = await response.text();
    if (response.status === 429 && attempt < OPENAI_RETRY_DELAYS_MS.length) {
      await waitForOpenAiRetry(OPENAI_RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`OpenAI request failed with ${response.status}: ${responseText}`);
  }
}

export async function prepareImageForOcr(imageUrl: string) {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("data:image/")) return imageUrl;
  const response = await fetchExternal(imageUrl, { headers: { Accept: "image/*", "User-Agent": "WeekendVibes/1.0" } }, 8_000, false);
  if (!response.ok) throw new Error(`Instagram image download failed with ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error(`Instagram image returned unsupported content type: ${contentType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("Instagram image download returned an empty body");
  const encoded = bytes.toString("base64");
  bytes.fill(0);
  return `data:${contentType};base64,${encoded}`;
}

export function isRecoverableOcrRateLimit(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("rate_limit_exceeded") || message.includes("Rate limit reached");
}

export function shouldExtractInstagramMediaOcr(post: InstagramPost, caption: string, imageUrl: string) {
  return Boolean(imageUrl) && (post.mediaType === "story" || post.mediaType === "highlight" || !caption.trim());
}

export function resolveInstagramVisualUrl(post: InstagramPost) {
  const thumbnailUrl = String(post.thumbnailUrl ?? post.thumbnail_url ?? "").trim();
  if (post.isVideo && (post.mediaType === "story" || post.mediaType === "highlight") && thumbnailUrl.startsWith("https://")) return thumbnailUrl;
  return String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? "").trim();
}

export async function extractOcrText(imageUrl: string) {
  if (!imageUrl) return "";
  const requestOcr = async (imagePayload: string) => openAiChat({
      model: MODEL,
      temperature: 0,
      messages: [{ role: "user", content: [
        { type: "text", text: "Transcreva literalmente todo o texto legível desta imagem. Não resuma, não corrija e não invente conteúdo." },
        { type: "image_url", image_url: { url: imagePayload, detail: "high" } },
      ] }],
    });
  const isPublicUrl = /^https?:\/\//i.test(imageUrl);
  let directError: unknown;
  if (isPublicUrl) {
    try {
      const result = await requestOcr(imageUrl);
      const text = String(result.choices?.[0]?.message?.content ?? "");
      if (text.trim()) return text;
      directError = new Error("OpenAI retornou OCR vazio para a URL pública");
    } catch (error) {
      if (isRecoverableOcrRateLimit(error)) throw error;
      directError = error;
    }
  }
  try {
    const imagePayload = await prepareImageForOcr(imageUrl);
    const result = await requestOcr(imagePayload);
    return String(result.choices?.[0]?.message?.content ?? "");
  } catch (error) {
    if (isRecoverableOcrRateLimit(error)) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[Instagram OCR] Rate limit reached; continuing with caption only:", message);
      try { await recordOperationalAlert({ integration: "ocr", title: "Limite temporário do OCR", message }); } catch (alertError) { console.warn("[Instagram OCR] Could not persist rate-limit alert:", alertError); }
      return "";
    }
    if (error instanceof InstagramIntegrationFailure) throw error;
    const fallbackMessage = error instanceof Error ? error.message : String(error);
    const directMessage = directError instanceof Error ? directError.message : String(directError ?? "");
    const message = directMessage ? `${directMessage}; fallback Base64: ${fallbackMessage}` : fallbackMessage;
    console.warn("[Instagram OCR] Image unavailable; continuing with caption only:", message);
    try { await recordOperationalAlert({ integration: "ocr", title: "Imagem do Instagram indisponível", message }); } catch (alertError) { console.warn("[Instagram OCR] Could not persist image alert:", alertError); }
    return "";
  }
}

function metaPostsFromPayload(payload: unknown, target: (typeof INSTAGRAM_TARGETS)[number]): InstagramPost[] {
  try {
    const parsed = parseMetaBusinessDiscovery(payload);
    return parsed.business_discovery.media.data.map(item => ({
      id: item.id,
      caption: item.caption ?? undefined,
      timestamp: item.timestamp ?? undefined,
      permalink: item.permalink ?? undefined,
      media_url: item.media_url ?? undefined,
      displayUrl: item.media_url ?? undefined,
      ownerUsername: item.username ?? target.username,
      mediaType: "post",
    }));
  } catch (error) {
    throw new InstagramIntegrationFailure("meta", "Meta Graph API retornou payload fora do contrato", { cause: error });
  }
}

type InstagramTransportFailure = { username: string; status: number; kind: "proxy_or_session" | "circuit_open" | "quota" | "actor_timeout"; message: string };
type InstagramProviderIssue = { code: "APIFY_QUOTA_EXCEEDED"; status: 403; message: string };

function logInstagramResponseDiagnostics(input: { username: string; status: number; contentType: string | null; body: string; parsed: boolean; mediaCount: number; maskedHtml: boolean }) {
  if (process.env.INGESTION_VERBOSE_DRY_RUN !== "1") return;
  console.info("[Ingestion dry-run] instagram response", {
    username: input.username,
    status: input.status,
    contentType: input.contentType?.split(";")[0] ?? null,
    bytes: Buffer.byteLength(input.body, "utf8"),
    parsedJson: input.parsed,
    mediaCount: input.mediaCount,
    maskedHtml: input.maskedHtml,
  });
}

export async function fetchMetaBusinessDiscoveryPostsDetailed(token: string, accountId: string, options: { dryRun?: boolean } = {}): Promise<{ posts: InstagramPost[]; transportFailures: InstagramTransportFailure[] }> {
  const posts: InstagramPost[] = [];
  const transportFailures: InstagramTransportFailure[] = [];
  const configuredSources = (await listEnabledInstagramSources()) ?? [];
  const configuredHandles = new Set(configuredSources.map(source => source.handle?.replace(/^@/, "").toLowerCase()).filter(Boolean));
  const focusedHandle = process.env.INGESTION_FOCUS_INSTAGRAM?.trim().replace(/^@/, "").toLowerCase();
  const configuredTargets = configuredSources.length ? INSTAGRAM_TARGETS.filter(target => configuredHandles.has(target.username.toLowerCase())) : INSTAGRAM_TARGETS;
  const targets = (focusedHandle ? configuredTargets.filter(target => target.username.toLowerCase() === focusedHandle) : configuredTargets).slice().sort((left, right) => {
    const leftPriority = configuredSources.find(source => source.handle?.replace(/^@/, "").toLowerCase() === left.username.toLowerCase())?.priority ?? 50;
    const rightPriority = configuredSources.find(source => source.handle?.replace(/^@/, "").toLowerCase() === right.username.toLowerCase())?.priority ?? 50;
    return leftPriority - rightPriority;
  });
  const forceRefresh = process.env.INGESTION_FORCE_INSTAGRAM === "1";
  for (const target of targets) {
    const source = configuredSources.find(item => item.handle?.replace(/^@/, "").toLowerCase() === target.username.toLowerCase());
    if (source && !options.dryRun) {
      const circuit = await allowSourceAttempt(source.sourceKey);
      if (!circuit.allowed) {
        transportFailures.push({ username: target.username, status: 0, kind: "circuit_open", message: "Fonte pausada pelo Circuit Breaker durante o cooldown." });
        continue;
      }
    }
    if (!options.dryRun && !forceRefresh && source?.lastSuccessAt && Date.now() - new Date(source.lastSuccessAt).getTime() < source.frequencyMinutes * 60_000) {
      await markIngestionSourceResult(source.sourceKey, { status: "skipped", message: "Aguardando a próxima janela configurada." });
      continue;
    }
    const fields = `business_discovery.username(${target.username}){username,media.limit(25){id,caption,timestamp,permalink,media_url,media_type}}`;
    const url = `${META_GRAPH_BASE_URL}/${accountId}?${new URLSearchParams({ fields, access_token: token }).toString()}`;
    const response = await fetchExternal(url, { headers: { Accept: "application/json" } }, 12_000, true);
    const responseBody = await readExternalBody(response);
    let parsedBody: unknown = null;
    let parsed = false;
    try { parsedBody = JSON.parse(responseBody); parsed = true; } catch { /* resposta não JSON */ }
    const mediaCount = parsedBody && typeof parsedBody === "object" ? (((parsedBody as { business_discovery?: { media?: { data?: unknown[] } } }).business_discovery?.media?.data) ?? []).length : 0;
    const maskedHtml = /<html|<body|login|checkpoint|challenge/i.test(responseBody.slice(0, 1200));
    logInstagramResponseDiagnostics({ username: target.username, status: response.status, contentType: response.headers.get("content-type"), body: responseBody, parsed, mediaCount, maskedHtml });
    if (response.ok && maskedHtml) {
      resetInstagramSessionForRetry("meta_200_masked_session");
      if (source && !options.dryRun) await registerSourceFailure({ sourceKey: source.sourceKey, routine: "instagram-agenda", status: response.status, message: "Resposta HTML mascarada recebida onde era esperado JSON; perfil ignorado nesta tentativa." });
      transportFailures.push({ username: target.username, status: response.status, kind: "proxy_or_session", message: "Resposta mascarada de sessão/proxy; perfil ignorado nesta tentativa." });
      continue;
    }
    if (!response.ok) {
      if (source && !options.dryRun) await markIngestionSourceResult(source.sourceKey, { status: "failed", message: `HTTP ${response.status}` });
      if (isMetaCredentialFailure(response.status, responseBody)) {
        const message = "Token da Meta Expirado - Atualize a variável META_INSTAGRAM_TOKEN";
        resetInstagramSessionForRetry(`meta_credentials_${response.status}`);
        if (source && !options.dryRun) await registerSourceFailure({ sourceKey: source.sourceKey, routine: "instagram-agenda", status: response.status, message });
        if (!options.dryRun) {
          try {
            await recordOperationalAlert({ integration: "meta", alertType: "meta_token_expired", severity: "WARNING", title: "Token da Meta expirado", message: `${message}. A ingestão continuará em modo degradado e a etapa Apify poderá prosseguir.` });
          } catch (alertError) {
            console.warn("[Instagram] Could not persist Meta token alert", { message: normalizeDiagnosticText(alertError instanceof Error ? alertError.message : alertError, 160) });
          }
        }
        console.warn("[Instagram] Meta credential rejected; continuing with Apify", { username: target.username, status: response.status, reason: message });
        transportFailures.push({ username: target.username, status: response.status, kind: "proxy_or_session", message });
        continue;
      }
      if (isInstagramTransportFailure(response.status, responseBody)) {
        resetInstagramSessionForRetry(`meta_${response.status}`);
        if (source && !options.dryRun) await registerSourceFailure({ sourceKey: source.sourceKey, routine: "instagram-agenda", status: response.status, message: `Meta respondeu HTTP ${response.status}; perfil ignorado nesta tentativa.` });
        transportFailures.push({ username: target.username, status: response.status, kind: "proxy_or_session", message: `Meta respondeu HTTP ${response.status}; perfil ignorado nesta tentativa.` });
        continue;
      }
      throw new InstagramIntegrationFailure("meta", `Meta Graph API request failed with ${response.status}: ${responseBody}`);
    }
    posts.push(...metaPostsFromPayload(parsedBody ?? JSON.parse(responseBody), target));
    if (source && !options.dryRun) {
      await registerSourceSuccess(source.sourceKey);
      await markIngestionSourceResult(source.sourceKey, { status: "succeeded", message: "Business Discovery respondeu com sucesso." });
    }
  }
  return { posts, transportFailures };
}

export const DEFAULT_APIFY_SYNC_TIMEOUT_MS = 60_000;
export const DEFAULT_APIFY_STORIES_ACTOR_ID = "zaver.api~instagram-stories-highlights-scraper";

export function getConfiguredApifyStoriesActorId() {
  return process.env.APIFY_STORIES_ACTOR_ID?.trim() || DEFAULT_APIFY_STORIES_ACTOR_ID;
}

export function getApifySyncTimeoutMs() {
  const configured = Number.parseInt(process.env.APIFY_SYNC_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_APIFY_SYNC_TIMEOUT_MS;
  return Math.min(90_000, Math.max(60_000, configured));
}

function isAbortTimeout(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || /aborted|timeout|timed out|tempo limite/i.test(error.message));
}

export async function claimApifyBudgetOrReport(input: { units?: number; allowIsolatedManualRun?: boolean } = {}) {
  const units = Math.min(100, Math.max(1, Math.trunc(input.units ?? INSTAGRAM_TARGETS.length)));
  const budget = await claimApifyDailyRequest({ units, allowIsolatedManualRun: input.allowIsolatedManualRun });
  if (budget.allowed) return budget;
  const message = budget.blockedReason === "kill_switch"
    ? "Extração Apify bloqueada pelo kill switch operacional; nenhuma chamada paga foi iniciada."
    : budget.blockedReason === "budget_unavailable"
      ? "Extração Apify bloqueada porque o orçamento persistido não está disponível; nenhuma chamada paga foi iniciada."
      : `Limite diário de chamadas Apify atingido (${budget.requestCount}/${budget.dailyLimit}) em ${budget.dateKey}; novas extrações bloqueadas até a meia-noite de Brasília.`;
  await recordOperationalAlert({ integration: "pipeline", alertType: budget.blockedReason === "kill_switch" ? "apify_kill_switch_active" : "apify_daily_limit_reached", severity: "CRITICAL", title: "Extração Apify bloqueada", message });
  return { ...budget, blockedMessage: message };
}

export async function fetchApifyStoriesAndHighlights(options: { dryRun?: boolean; targets?: ReadonlyArray<{ username: string }>; allowIsolatedManualRun?: boolean } = {}) {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return { posts: [] as InstagramPost[], transportFailures: [] as InstagramTransportFailure[] };
  const targets = options.targets ?? INSTAGRAM_TARGETS;
  const budget = await claimApifyBudgetOrReport({ units: targets.length, allowIsolatedManualRun: options.allowIsolatedManualRun });
  if (!budget.allowed) {
    const message = "blockedMessage" in budget ? budget.blockedMessage : "Limite diário de chamadas Apify atingido.";
    return { posts: [] as InstagramPost[], transportFailures: [{ username: "apify-budget", status: 429, kind: "quota" as const, message }] };
  }
    const payload = buildInstagramStoriesScraperPayload(targets);
  try {
    const timeoutMs = getApifySyncTimeoutMs();
    const response = await fetchExternal(`https://api.apify.com/v2/acts/${encodeURIComponent(getConfiguredApifyStoriesActorId())}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=30`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "WeekendVibes/1.0" }, body: JSON.stringify(payload) }, timeoutMs, true);
    const body = await readExternalBody(response);
    if (!response.ok) {
      let providerMessage = "";
      try {
        const parsedError = JSON.parse(body) as { error?: { message?: unknown } };
        providerMessage = typeof parsedError.error?.message === "string" ? parsedError.error.message : "";
      } catch {
        providerMessage = "";
      }
      const detail = normalizeDiagnosticText(providerMessage).slice(0, 180);
      const quotaExceeded = response.status === 403 && /monthly usage hard limit|quota|usage limit|limit exceeded/i.test(detail);
      const actorTimedOut = [408, 504].includes(response.status) || /timeout|timed out|tempo limite/i.test(detail);
      const message = quotaExceeded
        ? "Cota mensal do Apify excedida; renove a quota ou injete um token com limite disponível."
        : actorTimedOut
          ? `Timeout de conexão com o coletor Apify (HTTP ${response.status}) após ${getApifySyncTimeoutMs()} ms.`
          : `Apify respondeu HTTP ${response.status}${detail ? `: ${detail}` : "."}`;
      return { posts: [] as InstagramPost[], providerIssue: quotaExceeded ? { code: "APIFY_QUOTA_EXCEEDED" as const, status: 403 as const, message } : undefined, transportFailures: [{ username: "apify-collector", status: response.status, kind: quotaExceeded ? "quota" as const : actorTimedOut ? "actor_timeout" as const : "proxy_or_session" as const, message }] };
    }
    const parsed = JSON.parse(body) as unknown;
    const configuredSources = (await listEnabledInstagramSources()) ?? [];
    const sourceByHandle = new Map(configuredSources.map(source => [String(source.handle ?? "").replace(/^@/, "").toLowerCase(), source.sourceKey]));
    const allowedHandles = configuredSources.length > 0 ? sourceByHandle : new Map(targets.map(target => [target.username.toLowerCase(), `instagram:${target.username}`]));
    const posts = limitInstagramStoriesForCost(normalizeInstagramMediaPayload(parsed)
      .filter((post: InstagramPost) => post.mediaType === "story" || post.mediaType === "highlight")
      .filter((post: InstagramPost) => allowedHandles.has(String(post.ownerUsername ?? post.username ?? "").replace(/^@/, "").toLowerCase()))
      .map((post: InstagramPost) => ({
        ...post,
        sourceKey: allowedHandles.get(String(post.ownerUsername ?? post.username ?? "").replace(/^@/, "").toLowerCase()),
      })), new Date());
    if (posts.length === 0) {
      const diagnostic = "Apify respondeu HTTP 200, mas nenhum Story/Destaque parseável foi encontrado no payload.";
      console.warn("[Instagram Stories]", diagnostic, { topLevelKeys: parsed && typeof parsed === "object" ? Object.keys(parsed as Record<string, unknown>).slice(0, 20) : [] });
      return { posts, transportFailures: [{ username: "apify-instagram", status: response.status, kind: "proxy_or_session" as const, message: diagnostic }] };
    }
    return { posts, transportFailures: [] as InstagramTransportFailure[] };
  } catch (error) {
    const timedOut = isAbortTimeout(error);
    const message = timedOut
      ? `Timeout de conexão com o coletor Apify após ${getApifySyncTimeoutMs()} ms.`
      : normalizeDiagnosticText(error instanceof Error ? error.message : error) || "Falha ao consultar o scraper de Stories.";
    return { posts: [] as InstagramPost[], transportFailures: [{ username: "apify-collector", status: 0, kind: timedOut ? "actor_timeout" as const : "proxy_or_session" as const, message }] };
  }
}

export async function fetchInstagramPostsDetailed(options: { dryRun?: boolean } = {}) {
  const token = requiredEnv("META_INSTAGRAM_TOKEN");
  const accountId = requiredEnv("META_INSTAGRAM_ACCOUNT_ID");
  let meta: { posts: InstagramPost[]; transportFailures: InstagramTransportFailure[] } = { posts: [], transportFailures: [] };
  try {
    meta = await fetchMetaBusinessDiscoveryPostsDetailed(token, accountId, options);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const credentialFailure = /oauthexception|invalid oauth|access token|expired|token.*invalid|META_INSTAGRAM_TOKEN|session.*expired/i.test(rawMessage);
    const statusMatch = rawMessage.match(/\b([45]\d{2})\b/);
    const status = statusMatch ? Number(statusMatch[1]) : 0;
    const message = credentialFailure
      ? "Token da Meta Expirado - Atualize a variável META_INSTAGRAM_TOKEN"
      : `Falha isolada na Graph API da Meta${status ? ` (HTTP ${status})` : ""}; a extração da Apify continuará.`;
    if (credentialFailure && !options.dryRun) {
      try {
        await recordOperationalAlert({ integration: "meta", alertType: "meta_token_expired", severity: "CRITICAL", title: "Token da Meta expirado", message });
      } catch (alertError) {
        console.warn("[Instagram] Could not persist isolated Meta alert", { message: normalizeDiagnosticText(alertError instanceof Error ? alertError.message : alertError, 160) });
      }
    }
    console.warn("[Instagram] Meta stage isolated; continuing with Apify", { status, reason: message });
    meta = { posts: [], transportFailures: [{ username: "meta-graph", status, kind: "proxy_or_session", message }] };
  }
  const supplemental = await fetchApifyStoriesAndHighlights(options);
  return { posts: [...meta.posts, ...supplemental.posts], transportFailures: [...meta.transportFailures, ...supplemental.transportFailures] };
}

export async function fetchInstagramPosts() {
  const result = await fetchInstagramPostsDetailed();
  return result.posts;
}

/**
 * Business Discovery expõe mídia publicada, não Stories de perfis de terceiros.
 * O retorno vazio é deliberado: não usamos scraping de sessão nem endpoints
 * privados e não fabricamos eventos quando Stories não estão disponíveis.
 */
export async function fetchInstagramStories(): Promise<InstagramPost[]> {
  const result = await fetchApifyStoriesAndHighlights({ dryRun: true });
  return result.posts.filter(post => post.mediaType === "story");
}

export function createMeuLugarSandboxStoryMock(referenceDate = getInstagramReferenceDate()): InstagramPost {
  return {
    id: "sandbox-meulugar-story-1",
    url: "https://www.instagram.com/stories/meulugar.bar/1234567890/",
    ownerUsername: "meulugar.bar",
    username: "meulugar.bar",
    mediaType: "story",
    displayUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
    timestamp: `${referenceDate}T12:00:00-03:00`,
    ocrText: `Meu Lugar Bar — Programação especial\n${referenceDate}\n22h\nAtrações: DJs convidados\nSantos`,
  };
}

function deduplicateInstagramPosts(posts: InstagramPost[]) {
  const seen = new Set<string>();
  return posts.filter(post => {
    const key = post.id ?? postUrl(post) ?? `${post.ownerUsername ?? post.username ?? "unknown"}|${post.timestamp ?? post.takenAt ?? "unknown"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const STRUCTURED_EVENTS_CHUNK_SIZE = 18;
export const INSTAGRAM_OCR_CONCURRENCY = 3;

async function processWithConcurrency<TItem, TResult>(items: TItem[], worker: (item: TItem) => Promise<TResult>, concurrency: number): Promise<PromiseSettledResult<TResult>[]> {
  const results: PromiseSettledResult<TResult>[] = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try { results[index] = { status: "fulfilled", value: await worker(items[index]!) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) }, runWorker));
  return results;
}
const STRUCTURED_EVENT_RESPONSE_FORMAT = { type: "json_schema", json_schema: { name: "instagram_weekend_events", strict: true, schema: {
  type: "object", properties: { events: { type: "array", items: { type: "object", properties: {
    title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string", enum: ["Santos", "Guarujá"] }, category: { type: "string", enum: ["show", "balada", "evento_musical"] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] }, priceCents: { type: "integer" }, imageUrl: { type: "string" }, sourceUrl: { type: "string" },
  }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "genre", "priceCents", "imageUrl", "sourceUrl"], additionalProperties: false } } }, required: ["events"], additionalProperties: false,
} } } as const;

function structuredEventsSystemPrompt(referenceDate: string) {
  return `Extraia somente eventos futuros de fim de semana, públicos e musicais, localizados exclusivamente em Santos ou Guarujá. Data de Referência: ${referenceDate}. Ignore rigorosamente qualquer postagem ou evento que se refira a data anterior à Data de Referência; não tente inferir datas passadas como futuras. A data mínima aceita é ${referenceDate}. Para MEDIA_ORIGIN story ou highlight, trate RAW_POST_TEXT como OCR da arte gráfica e extraia Nome do Evento, Data, Horário e Atrações somente do texto reconhecido. Se a legenda informar dia e mês, mas omitir o ano, infira o ano atual ou futuro que torne a data válida a partir da Data de Referência; nunca use um ano passado por padrão. Retorne eventDate em ISO 8601. Use apenas informações presentes no texto bruto. Se data, cidade, endereço ou gênero não forem verificáveis, descarte o evento. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Não invente preços; use 0 quando o texto não informar preço.`;
}

function serializeApprovedPost({ post, rawText }: { post: InstagramPost; rawText: string }) {
  return `SOURCE_URL: ${postUrl(post)}\nACCOUNT: ${post.ownerUsername ?? post.username ?? ""}\nMEDIA_ORIGIN: ${post.mediaType ?? "post"}${post.highlightTitle ? `\nHIGHLIGHT_TITLE: ${post.highlightTitle}` : ""}\nRAW_POST_TEXT: ${rawText.slice(0, 2500)}`;
}

async function extractStructuredEvents(referenceDate: string, approvedPosts: Array<{ post: InstagramPost; rawText: string }>) {
  if (approvedPosts.length === 0) return [] as StructuredEvent[];
  const events: StructuredEvent[] = [];
  for (let offset = 0; offset < approvedPosts.length; offset += STRUCTURED_EVENTS_CHUNK_SIZE) {
    const raw = approvedPosts.slice(offset, offset + STRUCTURED_EVENTS_CHUNK_SIZE).map(serializeApprovedPost).join("\n\n").slice(0, 48_000);
    try {
      const result = await openAiChat({ model: MODEL, temperature: 0, messages: [{ role: "system", content: structuredEventsSystemPrompt(referenceDate) }, { role: "user", content: raw }], response_format: STRUCTURED_EVENT_RESPONSE_FORMAT });
      const content = result.choices?.[0]?.message?.content ?? "{\"events\":[]}";
      const parsed = JSON.parse(content) as { events?: StructuredEvent[] };
      if (Array.isArray(parsed.events)) events.push(...parsed.events);
    } catch (error) {
      if (error instanceof InstagramIntegrationFailure) throw error;
      throw new InstagramIntegrationFailure("openai", error instanceof Error ? error.message : String(error), { cause: error });
    }
  }
  return events;
}

export async function extractStructuredEventsForTest(referenceDate: string, approvedPosts: Array<{ post: InstagramPost; rawText: string }>) {
  return extractStructuredEvents(referenceDate, approvedPosts);
}

export type InstagramPipelineOptions = { dryRun?: boolean; storiesOnly?: boolean; postsOverride?: InstagramPost[]; persistIncompleteToManualReview?: boolean };

export async function runInstagramPipeline(options: InstagramPipelineOptions = {}) {
  const pipelineStartedAt = Date.now();
  const dryRun = options.dryRun === true;
  const storiesOnly = options.storiesOnly === true;
  const referenceDate = getInstagramReferenceDate();
  if (!dryRun) await recordReferenceDateClockAlert(referenceDate);
  const activeAliases = await listActiveLocationAliasValues();
  const fetched = options.postsOverride
    ? { posts: options.postsOverride, transportFailures: [] as InstagramTransportFailure[] }
    : storiesOnly
      ? await fetchApifyStoriesAndHighlights({ dryRun })
      : await fetchInstagramPostsDetailed({ dryRun });
  const sandboxRestricted = process.env.NODE_ENV !== "production" && fetched.posts.length === 0 && (fetched.transportFailures.length === 0 && storiesOnly ? !process.env.APIFY_API_TOKEN : fetched.transportFailures.length > 0 && fetched.transportFailures.every(failure => failure.status === 0 || failure.status === 403 || failure.status === 502 || failure.status === 503 || failure.status === 504 || isSandboxRestrictedError(new Error(failure.message))));
  if (sandboxRestricted && shouldUseSandboxMocks()) {
    const durationMs = Math.max(1, Date.now() - pipelineStartedAt);
    const meuLugarStory = createMeuLugarSandboxStoryMock(referenceDate);
    const previewMockEvents = [
      { title: "Meu Lugar · Programação especial", eventDate: `${referenceDate}T22:00:00-03:00`, locationName: "Meu Lugar", city: "Santos", source: meuLugarStory.url, mediaOrigin: meuLugarStory.mediaType, imageUrl: meuLugarStory.displayUrl, ocrText: meuLugarStory.ocrText },
      { title: "Preview · Noite na Baixada", eventDate: `${referenceDate}T22:00:00-03:00`, locationName: "Ativa House", city: "Santos" },
      { title: "Preview · Sunset Guarujá", eventDate: `${referenceDate}T18:00:00-03:00`, locationName: "Laroc Club Guarujá", city: "Guarujá" },
      { title: "Preview · House Session", eventDate: `${referenceDate}T23:00:00-03:00`, locationName: "Vallum Garden", city: "Santos" },
    ];
    const providerIssue = "providerIssue" in fetched ? (fetched as { providerIssue?: InstagramProviderIssue }).providerIssue : undefined;
    return {
      dryRun, previewMock: true, sandboxRestricted: true, durationMs, sourceReports: [{ sourceKey: "instagram", durationMs, read: previewMockEvents.length, filtered: 0, persistable: dryRun ? previewMockEvents.length : 0, added: 0, updated: 0, ignored: 0, duplicates: 0, errors: [], rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
      previewMockEvents, providerIssue, quotaExceeded: providerIssue?.code === "APIFY_QUOTA_EXCEEDED", ocrAudit: previewMockEvents.map(event => ({ mediaOrigin: event.mediaOrigin ?? "story", imageUrl: String(event.imageUrl ?? "").slice(0, 1000), sourceUrl: String(event.source ?? "").slice(0, 1000), highlightTitle: null, ocrText: String(event.ocrText ?? "").slice(0, 3000), rawText: String(event.ocrText ?? "").slice(0, 5000) })).filter(item => item.imageUrl.startsWith("https://")), receivedPosts: previewMockEvents.length, approvedPosts: previewMockEvents.length, degraded: false, transportFailures: [],
      structuredEvents: previewMockEvents.length, imported: 0, persisted: 0, added: 0, updated: 0, ignored: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, rejectedEvents: [], rejectionReasons: {}, persistedEventIds: [], dateFilterValidation: { timezone: "America/Sao_Paulo", today: referenceDate, structuredEvents: previewMockEvents.length, pastEventsRejected: 0, acceptedTodayOrFuture: previewMockEvents.length },
    };
  }
  const posts = deduplicateInstagramPosts(fetched.posts);
  const approvedPosts: Array<{ post: InstagramPost; rawText: string }> = [];
  const ocrAuditCandidates: Array<{ post: InstagramPost; rawText: string }> = [];
  const forceFocusedRun = process.env.INGESTION_FORCE_INSTAGRAM === "1";
  const ocrResults = await processWithConcurrency(posts, async post => {
    if (!forceFocusedRun && !isWithinInstagramLookback(post)) return null;
    const caption = String(post.caption ?? post.text ?? "");
    const imageUrl = resolveInstagramVisualUrl(post);
    const isVisualMedia = post.mediaType === "story" || post.mediaType === "highlight";
    let ocrText = post.ocrText?.trim() ?? "";
    if (shouldExtractInstagramMediaOcr(post, caption, imageUrl) && !ocrText) {
      try {
        ocrText = await extractOcrText(imageUrl);
      } catch (error) {
        const message = normalizeDiagnosticText(error instanceof Error ? error.message : error, 240);
        console.warn("[Instagram OCR] Falha por mídia; continuando o processamento do lote", { mediaOrigin: post.mediaType ?? "post", sourceUrl: postUrl(post), message });
        try {
          await recordOperationalAlert({ integration: "ocr", title: "Falha ao processar OCR de mídia", message: `Mídia ${post.mediaType ?? "post"} não processada: ${message}` });
        } catch (alertError) {
          console.warn("[Instagram OCR] Could not persist media OCR alert:", alertError);
        }
      }
    }
    const rawText = [caption, ocrText].filter(value => value.trim()).join("\n");
    return { post, rawText, isVisualMedia, ocrText };
  }, INSTAGRAM_OCR_CONCURRENCY);
  for (const result of ocrResults) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const { post, rawText, isVisualMedia, ocrText } = result.value;
    if (isVisualMedia || ocrText) ocrAuditCandidates.push({ post, rawText });
    const regionalMarker = hasRegionalHashtag(rawText) ? "\nREGIONAL_HASHTAG_MATCH: Santos/Guarujá" : "";
    if (rawText.trim()) approvedPosts.push({ post, rawText: `${rawText}${regionalMarker}` });
  }

  const structuredEvents = await extractStructuredEvents(referenceDate, approvedPosts);
  const mediaOriginBySourceUrl = new Map(approvedPosts.map(({ post }) => [postUrl(post), post.mediaType ?? "post"]));
  let imported = 0;
  let added = 0;
  let updated = 0;
  let ignored = 0;
  let duplicates = 0;
  let missingCoordinates = 0;
  const rejectedEvents: StructuredEventRejection[] = [];
  const persistedEventIds: number[] = [];
  for (let index = 0; index < structuredEvents.length; index += 1) {
    const event = structuredEvents[index];
    const reasons = validateStructuredInstagramEvent(event, activeAliases);
    if (reasons.length > 0) {
      rejectedEvents.push(createStructuredEventRejection(event, index, reasons));
      continue;
    }
    const eventDate = normalizeStructuredEventDate(event.eventDate);
    const coordinates = await resolveRegionalCoordinates({ locationName: event.locationName, address: event.address, city: event.city });
    const sourceUrl = event.sourceUrl;
    const mediaOrigin = mediaOriginBySourceUrl.get(sourceUrl) ?? "post";
    const sourceType = mediaOrigin === "story" ? "instagram_story" : mediaOrigin === "highlight" ? "instagram_highlight" : INSTAGRAM_AGENDA_SOURCE_TYPE;
    const sourceHash = crypto.createHash("md5").update(`${sourceUrl}|${eventDate.toISOString().slice(0, 10)}|${event.title}`).digest("hex");
    const saved = dryRun ? { created: true, id: undefined, updated: false } : await saveEvent({
      title: event.title, slug: `${event.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${eventDate.getTime()}`,
      description: event.summary, eventDate, locationName: event.locationName, address: event.address, city: event.city,
      category: event.category, genre: event.genre, priceCents: event.priceCents || 0, priceNote: event.priceCents ? undefined : "Preço não informado na agenda do Instagram",
      ticketStatus: event.priceCents ? "available" : "unknown", sourceUrl, imageUrl: event.imageUrl || undefined, latitude: coordinates?.latitude, longitude: coordinates?.longitude,
      neighborhood: coordinates?.neighborhood ?? undefined, formattedAddress: coordinates?.formattedAddress ?? undefined, locationPrecision: coordinates ? (coordinates.confidence === "low" ? "approximate" : "exact") : undefined,
      sourceHash, sourceType, isPublished: 1, isArchived: 0,
    });
    if (!saved || typeof saved !== "object" || saved.created) added += 1;
    else if (saved.updated) updated += 1;
    else { duplicates += 1; ignored += 1; }
    if (saved?.id) persistedEventIds.push(saved.id);
    if (!coordinates) missingCoordinates += 1;
    imported += 1;
  }
  const rejectionReasons = summarizeStructuredRejections(rejectedEvents);
  const persistedCount = dryRun ? approvedPosts.length : added + updated;
  const filteredCount = Math.max(0, posts.length - persistedCount);
  const explicitFilteredCount = Object.entries(rejectionReasons).reduce((sum, [reason, count]) => reason === "fetch_failed" ? sum : sum + Math.max(0, Number(count) || 0), 0);
  if (filteredCount > explicitFilteredCount) rejectionReasons.unclassified_filtered = filteredCount - explicitFilteredCount;
  const acceptedSourceUrls = new Set(structuredEvents.filter((event, index) => validateStructuredInstagramEvent(event, activeAliases).length === 0).map(event => event.sourceUrl));
  const rejectedBySourceUrl = new Map(rejectedEvents.map(rejection => [rejection.sourceUrl, rejection.reasons]));
  let manualReviewInserted = 0;
  const filteredStories: FilteredInstagramStory[] = ocrAuditCandidates
    .filter(({ post }) => !acceptedSourceUrls.has(postUrl(post)))
    .map(({ post, rawText }, index) => {
      const sourceUrl = postUrl(post);
      const reasons = rejectedBySourceUrl.get(sourceUrl) ?? (rawText.trim() ? ["Não gerou evento estruturado aprovado"] : ["Sem texto suficiente para extração"]);
      const username = String(post.ownerUsername ?? post.username ?? "").replace(/^@/, "").trim().slice(0, 160);
      const imageUrl = String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? "").trim().slice(0, 1000);
      const postedAt = typeof post.postedAt === "string" ? post.postedAt.slice(0, 40) : null;
      const expiresAt = typeof post.expiresAt === "string" ? post.expiresAt.slice(0, 40) : null;
      const mediaOrigin: FilteredInstagramStory["mediaOrigin"] = post.mediaType === "highlight" ? "highlight" : "story";
      return { id: `${username}:${sourceUrl || imageUrl}:${postedAt ?? index}`.slice(0, 500), username, mediaOrigin, imageUrl, sourceUrl, postedAt, expiresAt, ocrText: String(post.ocrText ?? "").slice(0, 3000), rawText: rawText.slice(0, 5000), reasons: reasons.map(reason => String(reason).slice(0, 160)), status: "pending" as const };
    })
    .filter(item => item.imageUrl.startsWith("https://"));
  if (options.persistIncompleteToManualReview === true) {
    const structuredBySourceUrl = new Map(structuredEvents.map(event => [event.sourceUrl, event]));
    const reviewItems: ManualReviewEventInput[] = filteredStories
      .filter(story => story.rawText.trim().length > 0)
      .map(story => {
        const candidate = structuredBySourceUrl.get(story.sourceUrl);
        const category = ALLOWED_CATEGORIES.has(String(candidate?.category)) ? candidate?.category as StructuredEvent["category"] : null;
        return {
          title: String(candidate?.title ?? story.rawText.split(/\r?\n/)[0] ?? story.username).trim().slice(0, 255) || story.username || "Evento extraído do Instagram",
          eventDate: candidate?.eventDate ?? null,
          locationName: candidate?.locationName ?? null,
          address: candidate?.address ?? null,
          city: candidate?.city ?? null,
          category,
          genre: candidate?.genre ?? null,
          summary: candidate?.summary ?? story.rawText,
          priceCents: candidate?.priceCents ?? null,
          sourceUrl: story.sourceUrl || null,
          sourceType: story.mediaOrigin === "highlight" ? "instagram_highlight" : "instagram_story",
          imageUrl: story.imageUrl || null,
          rawText: story.rawText,
          reason: `Requer revisão manual: ${story.reasons.join("; ")}`,
        };
      });
    manualReviewInserted = (await persistManualReviewEvents(reviewItems)).inserted;
  }
  const sourceReports = [{
    sourceKey: "instagram",
    durationMs: Math.max(0, Date.now() - pipelineStartedAt),
    read: posts.length,
    filtered: filteredCount,
    persistable: dryRun ? imported : added + updated,
    added: dryRun ? 0 : added,
    updated: dryRun ? 0 : updated,
    ignored: dryRun ? 0 : ignored,
    duplicates,
    errors: fetched.transportFailures.map(failure => ({ sourceUrl: `@${failure.username}`, status: failure.status || null, message: failure.message })),
    rejectionReasons: {
      fetchFailed: fetched.transportFailures.length,
      outsideTargetVenue: Number(rejectionReasons.outside_target_venue ?? 0),
      invalidStructuredEvent: Number(rejectionReasons.invalid_date ?? 0) + Number(rejectionReasons.invalid_source_url ?? 0) + Number(rejectionReasons.missing_required_field ?? 0) + Number(rejectionReasons.invalid_category ?? 0) + Number(rejectionReasons.invalid_genre ?? 0),
      duplicate: duplicates,
      pastEvent: Number(rejectionReasons.past_event ?? 0),
      other: Number(rejectionReasons.unclassified_filtered ?? 0),
    },
  }];
  return {
    dryRun,
    durationMs: Math.max(0, Date.now() - pipelineStartedAt),
    sourceReports,
    receivedPosts: posts.length,
    approvedPosts: approvedPosts.length,
    degraded: fetched.transportFailures.length > 0,
    providerIssue: "providerIssue" in fetched ? (fetched as { providerIssue?: InstagramProviderIssue }).providerIssue : undefined,
    quotaExceeded: "providerIssue" in fetched && (fetched as { providerIssue?: InstagramProviderIssue }).providerIssue?.code === "APIFY_QUOTA_EXCEEDED",
    transportFailures: fetched.transportFailures,
    ocrAudit: buildOcrAuditEntries(ocrAuditCandidates),
    filteredStories,
    manualReviewInserted,

    structuredEvents: structuredEvents.length,
    imported,
    persisted: persistedCount,
    added: dryRun ? 0 : added,
    updated: dryRun ? 0 : updated,
    ignored: dryRun ? 0 : ignored,
    filtered: filteredCount,
    duplicates,
    missingCoordinates,
    outOfBoundsCoordinates: 0,
    rejectedEvents,
    rejectionReasons,
    persistedEventIds,
    dateFilterValidation: {
      timezone: "America/Sao_Paulo",
      today: saoPauloCalendarDate(new Date()),
      structuredEvents: structuredEvents.length,
      pastEventsRejected: rejectionReasons.past_event ?? 0,
      acceptedTodayOrFuture: Math.max(0, structuredEvents.length - (rejectionReasons.past_event ?? 0)),
    },
  };
}
