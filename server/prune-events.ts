import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

/**
 * The current schema stores venue/brand relationships by normalized location and
 * monitored-brand match terms rather than events.venueId/events.brandId and
 * venues.isCurated. Keep this list aligned with the official 15-venue spotlight.
 */
const CURATED_VENUE_NAMES = [
  "Guarujá Golf Club",
  "GOAT",
  "Goat Club",
  "Goat Dining Club",
  "Curvão Surf House",
  "Boteco Al Mare",
  "Flamingos",
  "Flamingo",
  "Vallum Garden",
  "Blue Med Convention Center",
  "Parque Valongo",
  "Casa 412",
  "Laroc Club",
  "Laroc Club Guarujá",
  "O Beco",
  "Dolores Restaurante e Bar",
  "Dolores Bar e Restaurante",
  "Projac Bar",
  "Meu Lugar",
  "Moby Dick",
] as const;

export const PRUNE_RETENTION_DAYS = 60;

function curatedVenueSql() {
  return sql.join(CURATED_VENUE_NAMES.map(name => sql`(${name})`), sql`, `);
}

export async function pruneExpiredEvents() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const curatedNames = sql`VALUES ${curatedVenueSql()}`;
  const result = await db.execute(sql`
    WITH curated_venues(canonical_name) AS ${curatedNames},
    deleted_events AS (
      DELETE FROM "events" e
      WHERE e."eventDate" < NOW() - INTERVAL '60 days'
        -- Monitored brands are protected through their configured match terms.
        AND NOT EXISTS (
          SELECT 1
          FROM "monitoredBrands" mb
          WHERE mb."isActive" = 1
            AND EXISTS (
              SELECT 1
              FROM unnest(mb."matchTerms") AS term
              WHERE lower(concat_ws(' ', e."title", e."description", e."locationName"))
                LIKE '%' || lower(term) || '%'
            )
        )
        -- Venue protection is based on the official spotlight catalog because
        -- this deployed schema has no events.venueId or venues.isCurated column.
        AND NOT EXISTS (
          SELECT 1
          FROM curated_venues cv
          WHERE lower(trim(e."locationName")) = lower(trim(cv.canonical_name))
        )
      RETURNING e.id
    )
    SELECT count(*)::int AS "deletedEventsCount" FROM deleted_events;
  `);

  const row = (result as unknown as Array<{ deletedEventsCount?: number }>)[0];
  return { deletedEventsCount: Number(row?.deletedEventsCount ?? 0) };
}

export async function pruneEventsHandler(_req: Request, res: Response) {
  try {
    const result = await pruneExpiredEvents();
    return res.status(200).json({ status: "success", ...result });
  } catch (error) {
    console.error("[PruneEvents] Failed to prune expired events", error instanceof Error ? error.message : "unknown_error");
    return res.status(503).json({ status: "error", error: "database_unavailable" });
  }
}
