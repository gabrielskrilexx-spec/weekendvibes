import crypto from "node:crypto";
import { INSTAGRAM_AGENDA_SOURCE_TYPE, listActiveLocationAliasValues, listEnabledInstagramSources, markIngestionSourceResult, recordOperationalAlert, saveEvent } from "./db";
import { fetchExternal, isSandboxRestrictedError, readExternalBody } from "./external-fetch";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings";
import { containsTargetVenue } from "./ingestion";
import { parseMetaBusinessDiscovery } from "./contracts/external";
import { resolveRegionalCoordinates } from "./geocoding";
import { allowSourceAttempt, registerSourceFailure, registerSourceSuccess } from "./circuit-breaker";

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

export const INSTAGRAM_TARGETS = [
  { name: "Moby House", username: "mobydicksantos", directUrl: "https://www.instagram.com/mobydicksantos/" },
  { name: "Projac Bar", username: "projac.bar", directUrl: "https://www.instagram.com/projac.bar/" },
  { name: "Meu Lugar Bar e Entretenimento", username: "meulugar.bar", directUrl: "https://www.instagram.com/meulugar.bar/" },
  { name: "Nosso After", username: "nossoafterguaruja", directUrl: "https://www.instagram.com/nossoafterguaruja/" },
  { name: "Curvão Surf House", username: "curvaosurfhouse", directUrl: "https://www.instagram.com/curvaosurfhouse/" },
  { name: "Flamingo Bar", username: "flamingomusicbar", directUrl: "https://www.instagram.com/flamingomusicbar/" },
  { name: "Rocket Sea Club", username: "rocketseaclub", directUrl: "https://www.instagram.com/rocketseaclub/" },
  { name: "Ativa House", username: "ativahouse", directUrl: "https://www.instagram.com/ativahouse/" },
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
  displayUrl?: string;
  imageUrl?: string;
  media_url?: string;
  ownerUsername?: string;
  username?: string;
  mediaType?: InstagramMediaOrigin;
};

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
  reasons: StructuredRejectionReason[];
  sourceUrlValid: boolean;
  eventDateValid: boolean;
  venueNormalized: string;
  cityNormalized: string;
  eventDateIso: string | null;
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
  if (typeof event.sourceUrl !== "string" || !/^https:\/\/www\.instagram\.com\/(p|reel|tv)\//i.test(event.sourceUrl)) reasons.push("invalid_source_url");
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
  const response = await fetch(imageUrl, { headers: { Accept: "image/*", "User-Agent": "WeekendVibes/1.0" } });
  if (!response.ok) throw new Error(`Instagram image download failed with ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error(`Instagram image returned unsupported content type: ${contentType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("Instagram image download returned an empty body");
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export function isRecoverableOcrRateLimit(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("rate_limit_exceeded") || message.includes("Rate limit reached");
}

export async function extractOcrText(imageUrl: string) {
  if (!imageUrl) return "";
  let imagePayload = "";
  try {
    imagePayload = await prepareImageForOcr(imageUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[Instagram OCR] Image unavailable; continuing with caption only:", message);
    try { await recordOperationalAlert({ integration: "ocr", title: "Imagem do Instagram indisponível", message }); } catch (alertError) { console.warn("[Instagram OCR] Could not persist image alert:", alertError); }
    return "";
  }
  try {
    const result = await openAiChat({
      model: MODEL,
      temperature: 0,
      messages: [{ role: "user", content: [
        { type: "text", text: "Transcreva literalmente todo o texto legível desta imagem. Não resuma, não corrija e não invente conteúdo." },
        { type: "image_url", image_url: { url: imagePayload, detail: "high" } },
      ] }],
    });
    return String(result.choices?.[0]?.message?.content ?? "");
  } catch (error) {
    if (isRecoverableOcrRateLimit(error)) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[Instagram OCR] Rate limit reached; continuing with caption only:", message);
      try { await recordOperationalAlert({ integration: "ocr", title: "Limite temporário do OCR", message }); } catch (alertError) { console.warn("[Instagram OCR] Could not persist rate-limit alert:", alertError); }
      return "";
    }
    if (error instanceof InstagramIntegrationFailure) throw error;
    throw new InstagramIntegrationFailure("ocr", error instanceof Error ? error.message : String(error), { cause: error });
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

type InstagramTransportFailure = { username: string; status: number; kind: "proxy_or_session" | "circuit_open"; message: string };

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

async function fetchMetaBusinessDiscoveryPostsDetailed(token: string, accountId: string, options: { dryRun?: boolean } = {}): Promise<{ posts: InstagramPost[]; transportFailures: InstagramTransportFailure[] }> {
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

export async function fetchInstagramPostsDetailed(options: { dryRun?: boolean } = {}) {
  const token = requiredEnv("META_INSTAGRAM_TOKEN");
  const accountId = requiredEnv("META_INSTAGRAM_ACCOUNT_ID");
  return fetchMetaBusinessDiscoveryPostsDetailed(token, accountId, options);
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
  return [];
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

async function extractStructuredEvents(referenceDate: string, approvedPosts: Array<{ post: InstagramPost; rawText: string }>) {
  if (approvedPosts.length === 0) return [] as StructuredEvent[];
  const raw = approvedPosts.map(({ post, rawText }) => `SOURCE_URL: ${postUrl(post)}\nACCOUNT: ${post.ownerUsername ?? post.username ?? ""}\nRAW_POST_TEXT: ${rawText}`).join("\n\n").slice(0, 48_000);
  try {
    const result = await openAiChat({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: `Extraia somente eventos futuros de fim de semana, públicos e musicais, localizados exclusivamente em Santos ou Guarujá. Data de Referência: ${referenceDate}. Ignore rigorosamente qualquer postagem ou evento que se refira a data anterior à Data de Referência; não tente inferir datas passadas como futuras. A data mínima aceita é ${referenceDate}. Se a legenda informar dia e mês, mas omitir o ano, infira o ano atual ou futuro que torne a data válida a partir da Data de Referência; nunca use um ano passado por padrão. Retorne eventDate em ISO 8601. Use apenas informações presentes no texto bruto. Se data, cidade, endereço ou gênero não forem verificáveis, descarte o evento. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Não invente preços; use 0 quando o texto não informar preço.` },
        { role: "user", content: raw },
      ],
      response_format: { type: "json_schema", json_schema: { name: "instagram_weekend_events", strict: true, schema: {
        type: "object", properties: { events: { type: "array", items: { type: "object", properties: {
          title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string", enum: ["Santos", "Guarujá"] }, category: { type: "string", enum: ["show", "balada", "evento_musical"] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] }, priceCents: { type: "integer" }, imageUrl: { type: "string" }, sourceUrl: { type: "string" },
        }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "genre", "priceCents", "imageUrl", "sourceUrl"], additionalProperties: false } } }, required: ["events"], additionalProperties: false,
      } } },
    });
    const content = result.choices?.[0]?.message?.content ?? "{\"events\":[]}";
    return (JSON.parse(content) as { events: StructuredEvent[] }).events;
  } catch (error) {
    if (error instanceof InstagramIntegrationFailure) throw error;
    throw new InstagramIntegrationFailure("openai", error instanceof Error ? error.message : String(error), { cause: error });
  }
}

export type InstagramPipelineOptions = { dryRun?: boolean };

export async function runInstagramPipeline(options: InstagramPipelineOptions = {}) {
  const pipelineStartedAt = Date.now();
  const dryRun = options.dryRun === true;
  const referenceDate = getInstagramReferenceDate();
  if (!dryRun) await recordReferenceDateClockAlert(referenceDate);
  const activeAliases = await listActiveLocationAliasValues();
  const fetched = await fetchInstagramPostsDetailed({ dryRun });
  const sandboxRestricted = process.env.NODE_ENV === "development" && fetched.posts.length === 0 && fetched.transportFailures.length > 0 && fetched.transportFailures.every(failure => failure.status === 0 || failure.status === 403 || failure.status === 502 || failure.status === 503 || failure.status === 504 || isSandboxRestrictedError(new Error(failure.message)));
  if (dryRun && sandboxRestricted && shouldUseSandboxMocks()) {
    const durationMs = Math.max(1, Date.now() - pipelineStartedAt);
    const previewMockEvents = [
      { title: "Preview · Noite na Baixada", eventDate: `${referenceDate}T22:00:00-03:00`, locationName: "Ativa House", city: "Santos" },
      { title: "Preview · Sunset Guarujá", eventDate: `${referenceDate}T18:00:00-03:00`, locationName: "Laroc Club Guarujá", city: "Guarujá" },
      { title: "Preview · House Session", eventDate: `${referenceDate}T23:00:00-03:00`, locationName: "Vallum Garden", city: "Santos" },
    ];
    return {
      dryRun: true, previewMock: true, sandboxRestricted: true, durationMs, sourceReports: [{ sourceKey: "instagram", durationMs, read: previewMockEvents.length, filtered: 0, persistable: previewMockEvents.length, added: 0, updated: 0, ignored: 0, duplicates: 0, errors: [{ sourceUrl: "preview://sandbox", status: null, message: "SANDBOX_RESTRICTED: eventos simulados somente para validação do Dry-run no preview." }], rejectionReasons: { fetchFailed: fetched.transportFailures.length, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
      previewMockEvents, receivedPosts: previewMockEvents.length, approvedPosts: previewMockEvents.length, degraded: true, transportFailures: fetched.transportFailures,
      structuredEvents: previewMockEvents.length, imported: 0, persisted: 0, added: 0, updated: 0, ignored: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, rejectedEvents: [], rejectionReasons: {}, persistedEventIds: [], dateFilterValidation: { timezone: "America/Sao_Paulo", today: referenceDate, structuredEvents: previewMockEvents.length, pastEventsRejected: 0, acceptedTodayOrFuture: previewMockEvents.length },
    };
  }
  const posts = deduplicateInstagramPosts(fetched.posts);
  const approvedPosts: Array<{ post: InstagramPost; rawText: string }> = [];
  const forceFocusedRun = process.env.INGESTION_FORCE_INSTAGRAM === "1";
  for (const post of posts) {
    if (!forceFocusedRun && !isWithinInstagramLookback(post)) continue;
    const caption = String(post.caption ?? post.text ?? "");
    const postUsername = post.ownerUsername ?? post.username;
    const ocrText = caption.trim() ? "" : await extractOcrText(String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? ""));
    const rawText = [caption, ocrText].filter(value => value.trim()).join("\n");
    const regionalMarker = hasRegionalHashtag(rawText) ? "\nREGIONAL_HASHTAG_MATCH: Santos/Guarujá" : "";
    if (rawText.trim()) approvedPosts.push({ post, rawText: `${rawText}${regionalMarker}` });
  }

  const structuredEvents = await extractStructuredEvents(referenceDate, approvedPosts);
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
    const sourceHash = crypto.createHash("md5").update(`${sourceUrl}|${eventDate.toISOString().slice(0, 10)}|${event.title}`).digest("hex");
    const saved = dryRun ? { created: true, id: undefined, updated: false } : await saveEvent({
      title: event.title, slug: `${event.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${eventDate.getTime()}`,
      description: event.summary, eventDate, locationName: event.locationName, address: event.address, city: event.city,
      category: event.category, genre: event.genre, priceCents: event.priceCents || 0, priceNote: event.priceCents ? undefined : "Preço não informado na agenda do Instagram",
      ticketStatus: event.priceCents ? "available" : "unknown", sourceUrl, imageUrl: event.imageUrl || undefined, latitude: coordinates?.latitude, longitude: coordinates?.longitude,
      neighborhood: coordinates?.neighborhood ?? undefined, formattedAddress: coordinates?.formattedAddress ?? undefined, locationPrecision: coordinates ? (coordinates.confidence === "low" ? "approximate" : "exact") : undefined,
      sourceHash, sourceType: INSTAGRAM_AGENDA_SOURCE_TYPE, isPublished: 1, isArchived: 0,
    });
    if (!saved || typeof saved !== "object" || saved.created) added += 1;
    else if (saved.updated) updated += 1;
    else { duplicates += 1; ignored += 1; }
    if (saved?.id) persistedEventIds.push(saved.id);
    if (!coordinates) missingCoordinates += 1;
    imported += 1;
  }
  const rejectionReasons = summarizeStructuredRejections(rejectedEvents);
  const sourceReports = [{
    sourceKey: "instagram",
    durationMs: Math.max(0, Date.now() - pipelineStartedAt),
    read: posts.length,
    filtered: Math.max(0, posts.length - approvedPosts.length) + rejectedEvents.length,
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
    },
  }];
  return {
    dryRun,
    durationMs: Math.max(0, Date.now() - pipelineStartedAt),
    sourceReports,
    receivedPosts: posts.length,
    approvedPosts: approvedPosts.length,
    degraded: fetched.transportFailures.length > 0,
    transportFailures: fetched.transportFailures,

    structuredEvents: structuredEvents.length,
    imported,
    persisted: dryRun ? 0 : added + updated,
    added: dryRun ? 0 : added,
    updated: dryRun ? 0 : updated,
    ignored: dryRun ? 0 : ignored,
    filtered: Math.max(0, posts.length - approvedPosts.length),
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
