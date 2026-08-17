import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { events, geocodingJobs } from "../drizzle/schema";
import { getDb } from "./db";

export const GEOCODING_PROVIDER = "nominatim" as const;
const MAX_ATTEMPTS = 3;
const CITY_FALLBACKS = {
  Santos: { latitude: "-23.9608", longitude: "-46.3336" },
  Guarujá: { latitude: "-23.9931", longitude: "-46.2564" },
} as const;

export function geocodingAddressHash(address: string, city: string) {
  return createHash("sha256").update(`${address.trim().toLowerCase()}|${city.trim().toLowerCase()}`).digest("hex");
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
    await db.update(geocodingJobs).set({ status: "processing", attempts: job.attempts + 1, lastError: null, updatedAt: new Date() }).where(eq(geocodingJobs.id, job.id));
    try {
      const address = `${event.address ?? event.locationName}, ${event.city}, São Paulo, Brasil`;
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`, { headers: { "user-agent": "WeekendVibes/1.0 (event-geocoding)" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`Nominatim respondeu ${response.status}`);
      const results = await response.json() as Array<{ lat?: string; lon?: string; importance?: number }>;
      const result = results[0];
      if (!result?.lat || !result.lon) throw new Error("Endereço não encontrado");
      await db.update(events).set({ latitude: result.lat, longitude: result.lon, locationPrecision: "exact", updatedAt: new Date() }).where(eq(events.id, event.id));
      await db.update(geocodingJobs).set({ status: "succeeded", provider: GEOCODING_PROVIDER, confidence: (result.importance ?? 0) >= 0.5 ? "high" : "medium", processedAt: new Date(), updatedAt: new Date() }).where(eq(geocodingJobs.id, job.id));
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = CITY_FALLBACKS[event.city as keyof typeof CITY_FALLBACKS];
      if (job.attempts + 1 >= MAX_ATTEMPTS && fallback) {
        await db.update(events).set({ latitude: fallback.latitude, longitude: fallback.longitude, locationPrecision: "approximate", updatedAt: new Date() }).where(eq(events.id, event.id));
      }
      await db.update(geocodingJobs).set({ status: "failed", provider: fallback && job.attempts + 1 >= MAX_ATTEMPTS ? "regional-fallback" : GEOCODING_PROVIDER, confidence: fallback && job.attempts + 1 >= MAX_ATTEMPTS ? "low" : undefined, lastError: message.slice(0, 2000), processedAt: new Date(), updatedAt: new Date() }).where(eq(geocodingJobs.id, job.id));
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
