import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { events, geocodingAuditLogs, geocodingJobs } from "../drizzle/schema";
import { getDb } from "./db";
import { buildRegionalGeocodingQuery, extractNeighborhood, geocodingAddressHash, getRegionalFallback, isWithinRegionalBounds, normalizeLocationText } from "./location";

export const GEOCODING_PROVIDER = "nominatim-regional" as const;
const MAX_ATTEMPTS = 3;

export { geocodingAddressHash, normalizeLocationText };

function isValidCoordinate(value: string | number | undefined) {
  return value !== undefined && value !== "" && Number.isFinite(Number(value));
}

async function auditGeocoding(db: Awaited<ReturnType<typeof getDb>>, input: { eventId: number; city: string; rawAddress?: string | null; normalizedAddress?: string | null; status: "invalid" | "fallback" | "rejected" | "succeeded"; message: string }) {
  if (!db) return;
  await db.insert(geocodingAuditLogs).values({ eventId: input.eventId, city: input.city, rawAddress: input.rawAddress?.slice(0, 500) ?? null, normalizedAddress: input.normalizedAddress?.slice(0, 500) ?? null, status: input.status, message: input.message.slice(0, 1000) });
}

export async function processPendingGeocoding(limit = 5) {
  const db = await getDb();
  if (!db) return { processed: 0, succeeded: 0, failed: 0, pending: 0 };
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  await db.update(geocodingJobs).set({ status: "pending", updatedAt: new Date() }).where(and(eq(geocodingJobs.status, "processing"), sql`${geocodingJobs.updatedAt} < DATE_SUB(NOW(), INTERVAL 15 MINUTE)`));
  const jobs = await db.select({ job: geocodingJobs, event: events }).from(geocodingJobs).innerJoin(events, eq(events.id, geocodingJobs.eventId)).where(and(inArray(geocodingJobs.status, ["pending", "failed"]), sql`${geocodingJobs.attempts} < ${MAX_ATTEMPTS}`, or(isNull(events.latitude), eq(events.latitude, ""), isNull(events.longitude), eq(events.longitude, "")))).orderBy(geocodingJobs.createdAt).limit(safeLimit);
  let succeeded = 0;
  let failed = 0;
  for (const { job, event } of jobs) {
    const rawAddress = event.address ?? event.locationName;
    const normalizedAddress = normalizeLocationText(rawAddress);
    const neighborhood = extractNeighborhood(event.address, event.locationName, event.city as "Santos" | "Guarujá");
    await db.update(geocodingJobs).set({ status: "processing", attempts: job.attempts + 1, lastError: null, updatedAt: new Date() }).where(eq(geocodingJobs.id, job.id));
    if (normalizedAddress.length < 3) {
      const fallback = getRegionalFallback(event.id, event.city as "Santos" | "Guarujá", rawAddress, event.locationName);
      await db.update(events).set({ latitude: fallback.latitude, longitude: fallback.longitude, neighborhood: fallback.neighborhood ?? neighborhood, formattedAddress: fallback.formattedAddress, locationPrecision: "approximate", updatedAt: new Date() }).where(eq(events.id, event.id));
      await auditGeocoding(db, { eventId: event.id, city: event.city, rawAddress, normalizedAddress, status: "invalid", message: "Endereço insuficiente; aplicado fallback regional controlado." });
      await db.update(geocodingJobs).set({ status: "failed", provider: "regional-fallback", confidence: "low", lastError: "Endereço insuficiente", processedAt: new Date(), updatedAt: new Date() }).where(eq(geocodingJobs.id, job.id));
      failed += 1;
      continue;
    }
    try {
      const query = buildRegionalGeocodingQuery(event.address, event.locationName, event.city as "Santos" | "Guarujá");
      const viewbox = "-46.46,-23.88,-46.15,-24.08";
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { "user-agent": "WeekendVibes/1.0 (regional-event-geocoding)" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`Provider respondeu ${response.status}`);
      const results = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string; importance?: number; address?: { neighbourhood?: string; suburb?: string; city?: string; town?: string } }>;
      const result = results.find(candidate => isValidCoordinate(candidate.lat) && isValidCoordinate(candidate.lon) && isWithinRegionalBounds(Number(candidate.lat), Number(candidate.lon)));
      if (!result?.lat || !result.lon) throw new Error("Endereço não localizado dentro de Santos/Guarujá");
      const resolvedNeighborhood = result.address?.neighbourhood ?? result.address?.suburb ?? neighborhood;
      await db.update(events).set({ latitude: result.lat, longitude: result.lon, neighborhood: resolvedNeighborhood?.slice(0, 160) ?? null, formattedAddress: (result.display_name ?? `${normalizedAddress}, ${event.city} - SP`).slice(0, 500), locationPrecision: "exact", updatedAt: new Date() }).where(eq(events.id, event.id));
      await db.update(geocodingJobs).set({ status: "succeeded", provider: GEOCODING_PROVIDER, confidence: (result.importance ?? 0) >= 0.5 ? "high" : "medium", processedAt: new Date(), updatedAt: new Date() }).where(eq(geocodingJobs.id, job.id));
      await auditGeocoding(db, { eventId: event.id, city: event.city, rawAddress, normalizedAddress, status: "succeeded", message: "Endereço normalizado e localizado dentro do limite regional." });
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = getRegionalFallback(event.id, event.city as "Santos" | "Guarujá", rawAddress, event.locationName);
      if (job.attempts + 1 >= MAX_ATTEMPTS) {
        await db.update(events).set({ latitude: fallback.latitude, longitude: fallback.longitude, neighborhood: fallback.neighborhood ?? neighborhood, formattedAddress: fallback.formattedAddress, locationPrecision: "approximate", updatedAt: new Date() }).where(eq(events.id, event.id));
        await auditGeocoding(db, { eventId: event.id, city: event.city, rawAddress, normalizedAddress, status: "fallback", message: `Falha de geocodificação: ${message}. Fallback regional aplicado.` });
      } else {
        await auditGeocoding(db, { eventId: event.id, city: event.city, rawAddress, normalizedAddress, status: "rejected", message: `Tentativa de geocodificação rejeitada: ${message}.` });
      }
      await db.update(geocodingJobs).set({ status: "failed", provider: job.attempts + 1 >= MAX_ATTEMPTS ? "regional-fallback" : GEOCODING_PROVIDER, confidence: job.attempts + 1 >= MAX_ATTEMPTS ? "low" : undefined, lastError: message.slice(0, 2000), processedAt: new Date(), updatedAt: new Date() }).where(eq(geocodingJobs.id, job.id));
      failed += 1;
    }
  }
  const [pending] = await db.select({ total: sql<number>`count(*)` }).from(geocodingJobs).where(inArray(geocodingJobs.status, ["pending", "processing"]));
  return { processed: jobs.length, succeeded, failed, pending: Number(pending?.total ?? 0) };
}

export async function listGeocodingSummary() {
  const db = await getDb();
  if (!db) return { pending: 0, processing: 0, succeeded: 0, failed: 0 };
  const rows = await db.select({ status: geocodingJobs.status, total: sql<number>`count(*)` }).from(geocodingJobs).groupBy(geocodingJobs.status);
  return rows.reduce((summary, row) => ({ ...summary, [row.status]: Number(row.total) }), { pending: 0, processing: 0, succeeded: 0, failed: 0 });
}
