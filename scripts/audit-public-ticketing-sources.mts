import { and, eq, isNotNull } from "drizzle-orm";
import { events, ingestionSources, locationAliases } from "../drizzle/schema";
import { getDb } from "../server/db";
import { buildTicketingCatalogAudit } from "../server/ticketing-catalog-audit";

const db = await getDb();
if (!db) {
  console.error(JSON.stringify({ ok: false, error: "database_unavailable" }));
  process.exitCode = 1;
} else {
  const [venueAliases, sources, publishedEvents] = await Promise.all([
    db.select({ alias: locationAliases.alias, canonicalName: locationAliases.canonicalName, city: locationAliases.city, isActive: locationAliases.isActive })
      .from(locationAliases)
      .where(eq(locationAliases.isActive, 1)),
    db.select({
      sourceKey: ingestionSources.sourceKey,
      name: ingestionSources.name,
      kind: ingestionSources.kind,
      handle: ingestionSources.handle,
      url: ingestionSources.url,
      isEnabled: ingestionSources.isEnabled,
      lastStatus: ingestionSources.lastStatus,
      lastHttpStatus: ingestionSources.lastHttpStatus,
      lastSuccessAt: ingestionSources.lastSuccessAt,
    }).from(ingestionSources),
    db.select({ locationName: events.locationName, city: events.city, sourceUrl: events.sourceUrl })
      .from(events)
      .where(and(eq(events.isPublished, 1), eq(events.isArchived, 0), isNotNull(events.sourceUrl))),
  ]);

  const report = buildTicketingCatalogAudit({ venueAliases, sources, events: publishedEvents });
  console.log(JSON.stringify(report, null, 2));
}
