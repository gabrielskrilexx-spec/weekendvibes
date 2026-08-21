import crypto from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { assertEventDateIsCurrentOrFuture, saveEvent } from "./db";
import { containsTargetVenue } from "./ingestion";

export type AgentEventDocument = { sourceUrl: string; text: string; imageUrl?: string };

const normalizeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function buildEventSourceHash(sourceUrl: string, title: string, eventDate: Date) {
  return crypto.createHash("md5").update(`${normalizeSlug(sourceUrl)}:${normalizeSlug(title)}:${eventDate.toISOString().slice(0, 10)}`).digest("hex");
}

export async function ingestAgentDocuments(documents: AgentEventDocument[]) {
  const safeDocuments = documents.filter(document =>
    /^https:\/\/(www\.)?(articket\.com\.br|blacktag\.com\.br|zig\.tickets|ingresse\.com)\//.test(document.sourceUrl) &&
    document.text.trim().length > 0 && document.text.length <= 16000,
  ).slice(0, 30);
  if (safeDocuments.length === 0) return { imported: 0, received: documents.length, acceptedDocuments: 0 };

  const rawText = safeDocuments.map(document => `SOURCE_URL: ${document.sourceUrl}\nIMAGE_URL: ${document.imageUrl ?? ""}\nCONTENT: ${document.text}`).join("\n\n").slice(0, 48_000);
  const structured = await invokeLLM({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Extraia somente eventos futuros públicos de música, shows ou baladas dos locais Valluns/Vallum Garden, Lucky Scope, Verilonguinho, Moby House/Moby Dick, Curvão Surf House, Meu Lugar, Laroc Club Guarujá ou Guarujá Golf Club, localizados exclusivamente em Santos ou Guarujá. Ignore cidades diferentes, locais não-alvo e eventos sem música. Retorne somente JSON no schema. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Se o gênero não puder ser inferido com segurança, descarte o evento. Use o SOURCE_URL correspondente como sourceUrl." },
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
    try { assertEventDateIsCurrentOrFuture(date, new Date(), String(event.title)); } catch { continue; }
    const sourceUrl = String(event.sourceUrl);
    const sourceHash = buildEventSourceHash(sourceUrl, String(event.title), date);
    await saveEvent({ title: String(event.title), slug: `${normalizeSlug(String(event.title))}-${date.getTime()}`, description: String(event.summary), eventDate: date, locationName: String(event.locationName), address: String(event.address), city, category: category as "show" | "balada" | "evento_musical", genre, priceCents: Number(event.priceCents) || 0, sourceUrl, imageUrl: String(event.imageUrl || ""), latitude: String(event.latitude || ""), longitude: String(event.longitude || ""), sourceHash, isPublished: 1 });
    imported += 1;
  }
  return { imported, received: documents.length, acceptedDocuments: safeDocuments.length };
}
