import crypto from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { saveEvent } from "./db";

const DEFAULT_SOURCE_URLS = [
  "https://articket.com.br/e/6784/plants-happy-hour",
  "https://articket.com.br/",
  "https://blacktag.com.br/",
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
] as const;

const normalizeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function getConfiguredSourceUrls() {
  const configured = process.env.INGESTION_SOURCE_URL ?? process.env.INGESTION_SOURCE_URLS;
  if (configured !== undefined) return Array.from(new Set(configured.split(",").map(value => value.trim()).filter(Boolean)));
  return DEFAULT_SOURCE_URLS;
}

export function containsTargetVenue(value: string) {
  const normalized = normalizeText(value);
  return TARGET_VENUES.some(venue => normalized.includes(normalizeText(venue)));
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
      if ((url.pathname.startsWith("/e/") && url.hostname.includes("articket")) || (url.pathname.startsWith("/eventos/") && url.hostname.includes("blacktag"))) {
        links.add(url.href);
      }
    } catch {
      // Ignore malformed public links.
    }
  }
  return Array.from(links).slice(0, 40);
}

async function fetchPublicPage(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "WeekendVibesBot/1.0 (+public-event-ingestion)",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Fonte ${url} respondeu ${response.status}`);
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
  return { url, html, text: text.slice(0, 8000), imageUrl: imageMatch?.[1] ?? "" };
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
  const candidateUrls = await discoverCandidatePages();
  if (candidateUrls.length === 0) return { imported: 0, skipped: true, reason: "Nenhuma fonte de ingestão configurada" };
  const pages = await Promise.allSettled(candidateUrls.map(fetchPublicPage));
  const sourcePages = pages
    .filter((result): result is PromiseFulfilledResult<{ url: string; html: string; text: string; imageUrl: string }> => result.status === "fulfilled")
    .filter(result => containsTargetVenue(result.value.text))
    .map(result => result.value);

  if (sourcePages.length === 0) {
    return { imported: 0, skipped: false, discovered: candidateUrls.length, matchedSources: 0, reason: "Nenhum evento dos locais-alvo encontrado nas fontes públicas" };
  }

  const rawText = sourcePages
    .map(page => `SOURCE_URL: ${page.url}\nIMAGE_URL: ${page.imageUrl}\nCONTENT: ${page.text}`)
    .join("\n\n")
    .slice(0, 48_000);

  const structured = await invokeLLM({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Extraia somente eventos públicos de música, shows ou baladas dos locais Valluns/Vallum Garden, Lucky Scope, Verilonguinho, Moby House/Moby Dick, Curvão Surf House ou Meu Lugar, localizados exclusivamente em Santos ou Guarujá. Ignore eventos passados, cidades diferentes, locais não-alvo e eventos de gastronomia, esporte, teatro ou exposição sem música. Retorne somente JSON no schema. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Se o gênero não puder ser inferido com segurança, descarte o evento. Use o SOURCE_URL correspondente como sourceUrl e IMAGE_URL quando houver." },
      { role: "user", content: rawText },
    ],
    response_format: { type: "json_schema", json_schema: { name: "event_batch", strict: true, schema: { type: "object", properties: { events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string" }, category: { type: "string", enum: ["show", "balada", "evento_musical"] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] }, priceCents: { type: "integer" }, sourceUrl: { type: "string" }, imageUrl: { type: "string" }, latitude: { type: "string" }, longitude: { type: "string" } }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "genre", "priceCents", "sourceUrl", "imageUrl", "latitude", "longitude"], additionalProperties: false } } }, required: ["events"], additionalProperties: false } } },
  });

  const payload = JSON.parse(String(structured.choices?.[0]?.message?.content ?? "{\"events\":[]}")) as { events: Array<Record<string, string | number>> };
  let imported = 0;
  for (const event of payload.events) {
    const date = new Date(String(event.eventDate));
    const city = String(event.city);
    const category = String(event.category);
    const genre = String(event.genre);
    if (Number.isNaN(date.getTime()) || (city !== "Santos" && city !== "Guarujá") || !containsTargetVenue(`${event.locationName} ${event.address}`) || !["show", "balada", "evento_musical"].includes(category) || !["funk", "house_eletronica", "samba_pagode", "rap_trap"].includes(genre)) continue;
    const sourceHash = crypto.createHash("md5").update(`${normalizeSlug(String(event.sourceUrl))}:${normalizeSlug(String(event.title))}:${date.toISOString().slice(0, 10)}`).digest("hex");
    await saveEvent({ title: String(event.title), slug: `${normalizeSlug(String(event.title))}-${date.getTime()}`, description: String(event.summary), eventDate: date, locationName: String(event.locationName), address: String(event.address), city, category: category as "show" | "balada" | "evento_musical", genre, priceCents: Number(event.priceCents) || 0, sourceUrl: String(event.sourceUrl), imageUrl: String(event.imageUrl || ""), latitude: String(event.latitude || ""), longitude: String(event.longitude || ""), sourceHash, isPublished: 1 });
    imported += 1;
  }
  return { imported, skipped: false, discovered: candidateUrls.length, matchedSources: sourcePages.length };
}
