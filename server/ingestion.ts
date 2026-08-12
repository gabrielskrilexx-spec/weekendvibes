import crypto from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { saveEvent } from "./db";

const normalizeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function runIngestionPipeline() {
  const sourceUrl = process.env.INGESTION_SOURCE_URL;
  if (!sourceUrl) return { imported: 0, skipped: true, reason: "INGESTION_SOURCE_URL não configurada" };
  const response = await fetch(sourceUrl, { headers: { "user-agent": "WeekendVibesBot/1.0 (+event-ingestion)" } });
  if (!response.ok) throw new Error(`Fonte de ingestão respondeu ${response.status}`);
  const rawText = (await response.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 24000);
  const structured = await invokeLLM({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Extraia eventos públicos exclusivamente da Baixada Santista. Retorne um array JSON com title, summary, eventDate ISO, locationName, address, city, category, priceCents, sourceUrl, imageUrl, latitude e longitude. Ignore eventos fora de Santos, São Vicente, Guarujá, Praia Grande, Cubatão, Bertioga, Mongaguá, Itanhaém e Peruíbe." },
      { role: "user", content: rawText },
    ],
    response_format: { type: "json_schema", json_schema: { name: "event_batch", strict: true, schema: { type: "object", properties: { events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string" }, category: { type: "string", enum: ["show", "festa", "gastronomia", "esporte", "cultura"] }, priceCents: { type: "integer" }, sourceUrl: { type: "string" }, imageUrl: { type: "string" }, latitude: { type: "string" }, longitude: { type: "string" } }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "priceCents", "sourceUrl", "imageUrl", "latitude", "longitude"], additionalProperties: false } } }, required: ["events"], additionalProperties: false } } },
  });
  const payload = JSON.parse(String(structured.choices?.[0]?.message?.content ?? "{\"events\":[]}")) as { events: Array<Record<string, string | number>> };
  for (const event of payload.events) {
    const date = new Date(String(event.eventDate));
    if (Number.isNaN(date.getTime())) continue;
    const sourceHash = crypto.createHash("md5").update(`${normalizeSlug(String(event.title))}${date.toISOString().slice(0, 10)}`).digest("hex");
    await saveEvent({ title: String(event.title), slug: `${normalizeSlug(String(event.title))}-${date.getTime()}`, description: String(event.summary), eventDate: date, locationName: String(event.locationName), address: String(event.address), city: String(event.city), category: event.category as "show" | "festa" | "gastronomia" | "esporte" | "cultura", priceCents: Number(event.priceCents) || 0, sourceUrl: String(event.sourceUrl || sourceUrl), imageUrl: String(event.imageUrl || ""), latitude: String(event.latitude || ""), longitude: String(event.longitude || ""), sourceHash, isPublished: 1 });
  }
  return { imported: payload.events.length, skipped: false };
}
