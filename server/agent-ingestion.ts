import crypto from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { assertEventDateIsCurrentOrFuture, saveEvent } from "./db";
import { containsTargetVenue } from "./ingestion";

export type AgentEventDocument = { sourceUrl: string; text: string; imageUrl?: string };

export type AgentReviewEvent = {
  title: string;
  eventDate: string;
  locationName: string;
  address: string;
  city: string;
  summary: string;
  sourceUrl: string;
  reason: string;
};

export type AgentIngestionResult = {
  imported: number;
  received: number;
  acceptedDocuments: number;
  pendingReview: AgentReviewEvent[];
};

const normalizeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function buildEventSourceHash(sourceUrl: string, title: string, eventDate: Date) {
  return crypto.createHash("md5").update(`${normalizeSlug(sourceUrl)}:${normalizeSlug(title)}:${eventDate.toISOString().slice(0, 10)}`).digest("hex");
}

export function buildAgentExtractionPrompt(referenceDate = new Date()) {
  const reference = referenceDate.toISOString().slice(0, 10);
  return `Extraia eventos públicos de música, shows ou baladas em Santos ou Guarujá. Hoje é ${reference}; resolva expressões relativas como "neste sábado", "amanhã", "sexta-feira" e "próximo fim de semana" para uma data ISO-8601 futura ou atual, considerando o fuso America/Sao_Paulo. Use o contexto do SOURCE_URL: se ele identificar claramente a conta oficial de uma casa de shows, assuma esse local como locationName quando a arte ou o texto omitirem o nome. Aceite formatações não convencionais, abreviações e texto parcial de flyers. Não descarte por gênero ausente, endereço incompleto ou categoria incerta: use string vazia e deixe a entrada para revisão manual. Uma entrada com title, eventDate e locationName deve ser preservada como revisão manual mesmo que outros campos estejam incompletos. Os locais-alvo conhecidos incluem Valluns/Vallum Garden, Lucky Scope, Verilonguinho, Moby House/Moby Dick, Curvão Surf House, Meu Lugar, Laroc Club Guarujá, Guarujá Golf Club e outros locais musicais identificados com segurança em Santos ou Guarujá. Retorne somente JSON no schema. Normalize category para show, balada ou evento_musical quando possível e genre para funk, house_eletronica, samba_pagode ou rap_trap quando possível. Use o SOURCE_URL correspondente como sourceUrl.`;
}

function reviewEventFromRaw(event: Record<string, string | number>, sourceUrl: string, reason: string): AgentReviewEvent | null {
  const title = String(event.title ?? "").trim();
  const eventDate = String(event.eventDate ?? "").trim();
  const locationName = String(event.locationName ?? "").trim();
  if (!title || !eventDate || !locationName) return null;
  return {
    title,
    eventDate,
    locationName,
    address: String(event.address ?? "").trim(),
    city: String(event.city ?? "").trim(),
    summary: String(event.summary ?? "").trim(),
    sourceUrl: String(event.sourceUrl || sourceUrl),
    reason,
  };
}

export async function ingestAgentDocuments(documents: AgentEventDocument[]): Promise<AgentIngestionResult> {
  const safeDocuments = documents.filter(document =>
    /^https:\/\/(www\.)?(articket\.com\.br|blacktag\.com\.br|zig\.tickets|ingresse\.com)\//.test(document.sourceUrl) &&
    document.text.trim().length > 0 && document.text.length <= 16000,
  ).slice(0, 30);
  if (safeDocuments.length === 0) return { imported: 0, received: documents.length, acceptedDocuments: 0, pendingReview: [] };

  const rawText = safeDocuments.map(document => `SOURCE_URL: ${document.sourceUrl}\nSOURCE_CONTEXT: Use the official profile/site context when the venue is omitted.\nIMAGE_URL: ${document.imageUrl ?? ""}\nCONTENT: ${document.text}`).join("\n\n").slice(0, 48_000);
  const structured = await invokeLLM({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: buildAgentExtractionPrompt() },
      { role: "user", content: rawText },
    ],
    response_format: { type: "json_schema", json_schema: { name: "event_batch", strict: true, schema: { type: "object", properties: { events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string" }, category: { type: "string", enum: ["show", "balada", "evento_musical", ""] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap", ""] }, priceCents: { type: "integer" }, sourceUrl: { type: "string" }, imageUrl: { type: "string" }, latitude: { type: "string" }, longitude: { type: "string" } }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "genre", "priceCents", "sourceUrl", "imageUrl", "latitude", "longitude"], additionalProperties: false } } }, required: ["events"], additionalProperties: false } } },
  });
  const payload = JSON.parse(String(structured.choices?.[0]?.message?.content ?? "{\"events\":[]}")) as { events: Array<Record<string, string | number>> };
  let imported = 0;
  const pendingReview: AgentReviewEvent[] = [];
  for (const event of payload.events) {
    const date = new Date(String(event.eventDate));
    const city = String(event.city ?? "");
    const category = String(event.category ?? "");
    const genre = String(event.genre ?? "");
    const title = String(event.title ?? "").trim();
    const locationName = String(event.locationName ?? "").trim();
    const sourceUrl = String(event.sourceUrl ?? "");
    const hasCoreFields = Boolean(title && !Number.isNaN(date.getTime()) && locationName);
    const eligibleForPublish = hasCoreFields && (city === "Santos" || city === "Guarujá") && containsTargetVenue(`${locationName} ${event.address ?? ""}`) && ["show", "balada", "evento_musical"].includes(category) && ["funk", "house_eletronica", "samba_pagode", "rap_trap"].includes(genre);
    if (!eligibleForPublish) {
      const review = reviewEventFromRaw(event, sourceUrl, hasCoreFields ? "revisao_manual_campos_parciais" : "extracao_incompleta");
      if (review) pendingReview.push(review);
      continue;
    }
    try { assertEventDateIsCurrentOrFuture(date, new Date(), title); } catch {
      const review = reviewEventFromRaw(event, sourceUrl, "data_precisa_de_revisao");
      if (review) pendingReview.push(review);
      continue;
    }
    const sourceHash = buildEventSourceHash(sourceUrl, title, date);
    await saveEvent({ title, slug: `${normalizeSlug(title)}-${date.getTime()}`, description: String(event.summary ?? ""), eventDate: date, locationName, address: String(event.address ?? ""), city, category: category as "show" | "balada" | "evento_musical", genre, priceCents: Number(event.priceCents) || 0, sourceUrl, imageUrl: String(event.imageUrl || ""), latitude: String(event.latitude || ""), longitude: String(event.longitude || ""), sourceHash, isPublished: 1 });
    imported += 1;
  }
  return { imported, received: documents.length, acceptedDocuments: safeDocuments.length, pendingReview };
}
