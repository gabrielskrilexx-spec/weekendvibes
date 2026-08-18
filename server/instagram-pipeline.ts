import crypto from "node:crypto";
import { INSTAGRAM_AGENDA_SOURCE_TYPE, listActiveLocationAliasValues, listEnabledInstagramSources, markIngestionSourceResult, recordOperationalAlert, saveEvent } from "./db";
import { containsTargetVenue } from "./ingestion";
import { parseMetaBusinessDiscovery } from "./contracts/external";

const META_GRAPH_BASE_URL = "https://graph.facebook.com/v26.0";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const LOOKBACK_DAYS = 5;


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

type StructuredEvent = {
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

export function hasApprovedAgendaText(text: string) {
  return text.includes("Agenda da semana") && (text.includes("#Sexta-Feira") || text.includes("#Sábado"));
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

async function fetchMetaBusinessDiscoveryPosts(token: string, accountId: string): Promise<InstagramPost[]> {
  const posts: InstagramPost[] = [];
  const configuredSources = (await listEnabledInstagramSources()) ?? [];
  const configuredHandles = new Set(configuredSources.map(source => source.handle?.replace(/^@/, "").toLowerCase()).filter(Boolean));
  const targets = (configuredSources.length ? INSTAGRAM_TARGETS.filter(target => configuredHandles.has(target.username.toLowerCase())) : INSTAGRAM_TARGETS).slice().sort((left, right) => {
    const leftPriority = configuredSources.find(source => source.handle?.replace(/^@/, "").toLowerCase() === left.username.toLowerCase())?.priority ?? 50;
    const rightPriority = configuredSources.find(source => source.handle?.replace(/^@/, "").toLowerCase() === right.username.toLowerCase())?.priority ?? 50;
    return leftPriority - rightPriority;
  });
  for (const target of targets) {
    const source = configuredSources.find(item => item.handle?.replace(/^@/, "").toLowerCase() === target.username.toLowerCase());
    if (source?.lastSuccessAt && Date.now() - new Date(source.lastSuccessAt).getTime() < source.frequencyMinutes * 60_000) {
      await markIngestionSourceResult(source.sourceKey, { status: "skipped", message: "Aguardando a próxima janela configurada." });
      continue;
    }
    const fields = `business_discovery.username(${target.username}){username,media.limit(25){id,caption,timestamp,permalink,media_url,media_type}}`;
    const url = `${META_GRAPH_BASE_URL}/${accountId}?${new URLSearchParams({ fields, access_token: token }).toString()}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const responseBody = await response.text();
    if (!response.ok) {
      if (source) await markIngestionSourceResult(source.sourceKey, { status: "failed", message: `HTTP ${response.status}` });
      throw new InstagramIntegrationFailure("meta", `Meta Graph API request failed with ${response.status}: ${responseBody}`);
    }
    posts.push(...metaPostsFromPayload(JSON.parse(responseBody), target));
    if (source) await markIngestionSourceResult(source.sourceKey, { status: "succeeded", message: "Business Discovery respondeu com sucesso." });
  }
  return posts;
}

export async function fetchInstagramPosts() {
  const token = requiredEnv("META_INSTAGRAM_TOKEN");
  const accountId = requiredEnv("META_INSTAGRAM_ACCOUNT_ID");
  return fetchMetaBusinessDiscoveryPosts(token, accountId);
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

async function extractStructuredEvents(approvedPosts: Array<{ post: InstagramPost; rawText: string }>) {
  if (approvedPosts.length === 0) return [] as StructuredEvent[];
  const raw = approvedPosts.map(({ post, rawText }) => `SOURCE_URL: ${postUrl(post)}\nACCOUNT: ${post.ownerUsername ?? post.username ?? ""}\nRAW_POST_TEXT: ${rawText}`).join("\n\n").slice(0, 48_000);
  try {
    const result = await openAiChat({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: "Extraia somente eventos futuros de fim de semana, públicos e musicais, localizados exclusivamente em Santos ou Guarujá. Use apenas informações presentes no texto bruto. Se data, cidade, endereço ou gênero não forem verificáveis, descarte o evento. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Não invente preços; use 0 quando o texto não informar preço." },
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

export async function runInstagramPipeline() {
  const activeAliases = await listActiveLocationAliasValues();
  const posts = deduplicateInstagramPosts(await fetchInstagramPosts());
  const approvedPosts: Array<{ post: InstagramPost; rawText: string }> = [];
  for (const post of posts) {
    if (!isWithinInstagramLookback(post)) continue;
    const caption = String(post.caption ?? post.text ?? "");
    const ocrText = hasApprovedAgendaText(caption) ? "" : await extractOcrText(String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? ""));
    const rawText = [caption, ocrText].filter(Boolean).join("\n");
    const regionalMarker = hasRegionalHashtag(rawText) ? "\nREGIONAL_HASHTAG_MATCH: Santos/Guarujá" : "";
    if (hasApprovedAgendaText(rawText)) approvedPosts.push({ post, rawText: `${rawText}${regionalMarker}` });
  }

  const structuredEvents = await extractStructuredEvents(approvedPosts);
  let imported = 0;
  for (const event of structuredEvents) {
    const eventDate = new Date(event.eventDate);
    if (Number.isNaN(eventDate.getTime()) || !containsTargetVenue(`${event.locationName} ${event.address}`, activeAliases)) continue;
    const sourceUrl = event.sourceUrl.startsWith("https://www.instagram.com/") ? event.sourceUrl : "";
    if (!sourceUrl) continue;
    const sourceHash = crypto.createHash("md5").update(`${sourceUrl}|${eventDate.toISOString().slice(0, 10)}|${event.title}`).digest("hex");
    await saveEvent({
      title: event.title, slug: `${event.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${eventDate.getTime()}`,
      description: event.summary, eventDate, locationName: event.locationName, address: event.address, city: event.city,
      category: event.category, genre: event.genre, priceCents: event.priceCents || 0, priceNote: event.priceCents ? undefined : "Preço não informado na agenda do Instagram",
      ticketStatus: event.priceCents ? "available" : "unknown", sourceUrl, imageUrl: event.imageUrl || undefined, latitude: undefined, longitude: undefined,
      sourceHash, sourceType: INSTAGRAM_AGENDA_SOURCE_TYPE, isPublished: 1, isArchived: 0,
    });
    imported += 1;
  }
  return { receivedPosts: posts.length, approvedPosts: approvedPosts.length, structuredEvents: structuredEvents.length, imported };
}
