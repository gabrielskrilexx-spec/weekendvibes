import type { Request, Response } from "express";
import { getDb, getExecutiveObservabilityReport } from "./db";
import { notifyWeeklyExecutiveReport } from "./alert-webhook";
import { redactError } from "./_core/security";
import { sql } from "drizzle-orm";

function rowsOf(result: unknown) {
  return result as Array<Record<string, unknown>>;
}

async function buildWeeklyOperationalReport(now: Date) {
  const base = await getExecutiveObservabilityReport(now, 7);
  const db = await getDb();
  if (!db) return { ...base, weeklyOperational: { unavailable: true, periodStart: new Date(now.getTime() - 7 * 86_400_000).toISOString(), periodEnd: now.toISOString(), ingestion: { newEditions: 0, rescrapes: 0, runs: 0, succeededRuns: 0, failedRuns: 0 }, monitoredBrands: [], ticketingApis: [], upcomingEvents: [] } };

  const periodStart = new Date(now.getTime() - 7 * 86_400_000);
  const upcomingEnd = new Date(now.getTime() + 7 * 86_400_000);
  const [ingestionResult, brandsResult, sourcesResult, eventsResult] = await Promise.all([
    db.execute(sql`
      SELECT count(*) FILTER (WHERE "createdAt" >= ${periodStart} AND "createdAt" < ${now} AND "sourceType" IS NOT NULL)::int AS "newEditions",
        count(*) FILTER (WHERE "updatedAt" >= ${periodStart} AND "updatedAt" < ${now} AND "updatedAt" - "createdAt" > interval '60 seconds')::int AS rescrapes,
        count(*) FILTER (WHERE "createdAt" >= ${periodStart} AND "createdAt" < ${now})::int AS "eventRows",
        (SELECT count(*)::int FROM "ingestionRuns" WHERE "startedAt" >= ${periodStart} AND "startedAt" < ${now}) AS runs,
        (SELECT count(*)::int FROM "ingestionRuns" WHERE "startedAt" >= ${periodStart} AND "startedAt" < ${now} AND status = 'succeeded') AS "succeededRuns",
        (SELECT count(*)::int FROM "ingestionRuns" WHERE "startedAt" >= ${periodStart} AND "startedAt" < ${now} AND status IN ('failed','partial')) AS "failedRuns"
      FROM events
    `),
    db.execute(sql`SELECT id, name, slug, cities, platforms, "matchTerms", "isActive" FROM "monitoredBrands" ORDER BY id`),
    db.execute(sql`
      SELECT "sourceKey", name, "isEnabled", "circuitState", "circuitFailureCount", "lastStatus", "lastHttpStatus", "lastFailureReason", "lastAttemptAt", "lastSuccessAt"
      FROM "ingestionSources"
      WHERE lower("sourceKey") LIKE ANY(ARRAY['public:articket%', 'public:zig%', 'public:weticket%', 'public:sympla%', 'public:ingresse%', 'public:blacktag%'])
      ORDER BY "sourceKey"
    `),
    db.execute(sql`
      SELECT id, title, "eventDate", "endDate", "locationName", address, city, category, genre, "priceCents", "priceNote", "sourceUrl", "sourceType"
      FROM events
      WHERE "isPublished" = 1 AND "isArchived" = 0 AND city IN ('Santos', 'Guarujá')
        AND "eventDate" >= ${now} AND "eventDate" < ${upcomingEnd}
      ORDER BY "eventDate" ASC LIMIT 100
    `),
  ]);

  const ingestion = rowsOf(ingestionResult)[0] ?? {};
  const rawBrands = rowsOf(brandsResult);
  const allEvents = rowsOf(await db.execute(sql`SELECT title, "sourceUrl", "eventDate", "isPublished", "isArchived" FROM events`));
  const monitoredBrands = rawBrands.map(brand => {
    const terms = Array.isArray(brand.matchTerms) ? brand.matchTerms.map(term => String(term).toLowerCase()) : [];
    const matches = allEvents.filter(event => {
      const haystack = `${String(event.title ?? "")} ${String(event.sourceUrl ?? "")}`.toLowerCase();
      return terms.some(term => term && haystack.includes(term));
    });
    return { id: Number(brand.id), name: String(brand.name), slug: String(brand.slug), cities: brand.cities ?? [], platforms: brand.platforms ?? [], isActive: Number(brand.isActive) === 1, matchedEvents: matches.length, activeEvents: matches.filter(event => Number(event.isPublished) === 1 && Number(event.isArchived) === 0).length, latestEventDate: matches.map(event => String(event.eventDate ?? "")).sort().at(-1) ?? null };
  });
  const ticketingApis = rowsOf(sourcesResult).map(source => ({ ...source, isEnabled: Number(source.isEnabled) === 1, circuitFailureCount: Number(source.circuitFailureCount ?? 0) }));
  return { ...base, weeklyOperational: { unavailable: false, periodStart: periodStart.toISOString(), periodEnd: now.toISOString(), upcomingPeriodEnd: upcomingEnd.toISOString(), ingestion: { newEditions: Number(ingestion.newEditions ?? 0), rescrapes: Number(ingestion.rescrapes ?? 0), eventRows: Number(ingestion.eventRows ?? 0), runs: Number(ingestion.runs ?? 0), succeededRuns: Number(ingestion.succeededRuns ?? 0), failedRuns: Number(ingestion.failedRuns ?? 0) }, monitoredBrands, ticketingApis, upcomingEvents: rowsOf(eventsResult) } };
}

export async function sendWeeklyExecutiveReport(now = new Date()) {
  const report = await buildWeeklyOperationalReport(now);
  const delivery = await notifyWeeklyExecutiveReport(report);
  return { report, delivery };
}

export async function maybeSendWeeklyExecutiveReport(now = new Date()) {
  if (now.getUTCDay() !== 1) return { sent: false, reason: "not-weekly-day" as const };
  const result = await sendWeeklyExecutiveReport(now);
  return { sent: true, ...result };
}

export async function weeklyExecutiveReportHandler(_req: Request, res: Response) {
  try {
    const result = await sendWeeklyExecutiveReport(new Date());
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("[WeeklyExecutiveReport] failed", redactError(error));
    return res.status(500).json({ ok: false, error: "Não foi possível gerar o relatório semanal." });
  }
}
