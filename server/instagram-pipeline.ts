import crypto from "node:crypto";
import { INSTAGRAM_AGENDA_SOURCE_TYPE, listActiveLocationAliasValues, saveEvent } from "./db";
import { containsTargetVenue } from "./ingestion";

const APIFY_RUN_URL = "https://api.apify.com/v2/actors/apify~instagram-scraper/run-sync-get-dataset-items";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const LOOKBACK_DAYS = 5;

export type InstagramIntegration = "apify" | "ocr" | "openai";

export class InstagramIntegrationFailure extends Error {
  constructor(public readonly integration: InstagramIntegration, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InstagramIntegrationFailure";
  }
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
  caption?: string;
  text?: string;
  timestamp?: string | number;
  takenAt?: string | number;
  displayUrl?: string;
  imageUrl?: string;
  ownerUsername?: string;
  username?: string;
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

export function hasApprovedAgendaText(text: string) {
  return text.includes("Agenda da semana") && (text.includes("#Sexta-Feira") || text.includes("#Sábado"));
}

function postUrl(post: InstagramPost) {
  if (post.url?.startsWith("https://www.instagram.com/")) return post.url;
  if (post.shortCode) return `https://www.instagram.com/p/${post.shortCode}/`;
  return "";
}

async function openAiChat(body: Record<string, unknown>) {
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${requiredEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}: ${await response.text()}`);
  return response.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
}

async function extractOcrText(imageUrl: string) {
  if (!imageUrl) return "";
  try {
    const result = await openAiChat({
      model: MODEL,
      temperature: 0,
      messages: [{ role: "user", content: [
        { type: "text", text: "Transcreva literalmente todo o texto legível desta imagem. Não resuma, não corrija e não invente conteúdo." },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      ] }],
    });
    return String(result.choices?.[0]?.message?.content ?? "");
  } catch (error) {
    if (error instanceof InstagramIntegrationFailure) throw error;
    throw new InstagramIntegrationFailure("ocr", error instanceof Error ? error.message : String(error), { cause: error });
  }
}

export async function fetchInstagramPosts() {
  try {
    const response = await fetch(APIFY_RUN_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${requiredEnv("APIFY_API_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        resultsType: "posts",
        directUrls: INSTAGRAM_TARGETS.map(target => target.directUrl),
        resultsLimit: 50,
      }),
    });
    if (!response.ok) throw new Error(`Apify Instagram Scraper failed with ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    return (Array.isArray(payload) ? payload : payload?.items ?? []) as InstagramPost[];
  } catch (error) {
    if (error instanceof InstagramIntegrationFailure) throw error;
    throw new InstagramIntegrationFailure("apify", error instanceof Error ? error.message : String(error), { cause: error });
  }
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
  const posts = await fetchInstagramPosts();
  const approvedPosts: Array<{ post: InstagramPost; rawText: string }> = [];
  for (const post of posts) {
    if (!isWithinInstagramLookback(post)) continue;
    const caption = String(post.caption ?? post.text ?? "");
    const ocrText = hasApprovedAgendaText(caption) ? "" : await extractOcrText(String(post.displayUrl ?? post.imageUrl ?? ""));
    const rawText = [caption, ocrText].filter(Boolean).join("\n");
    if (hasApprovedAgendaText(rawText)) approvedPosts.push({ post, rawText });
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
