import { eq } from "drizzle-orm";
import { locationAliases } from "../drizzle/schema";
import { getDb } from "../server/db";

const OFFICIAL_VENUES = [
  {
    alias: "Arena Club",
    canonicalName: "Arena Club",
    city: "Santos",
  },
  {
    alias: "Yellow House",
    canonicalName: "Yellow House",
    city: "Santos",
  },
] as const;

const db = await getDb();
if (!db) {
  console.error(JSON.stringify({ ok: false, error: "database_unavailable" }));
  process.exitCode = 1;
} else {
  let upserted = 0;
  for (const venue of OFFICIAL_VENUES) {
    await db.insert(locationAliases).values({ ...venue, isActive: 1 }).onConflictDoUpdate({
      target: locationAliases.alias,
      set: { canonicalName: venue.canonicalName, city: venue.city, isActive: 1, updatedAt: new Date() },
    });
    upserted += 1;
  }
  const aliases = await db.select({ alias: locationAliases.alias, canonicalName: locationAliases.canonicalName, city: locationAliases.city, isActive: locationAliases.isActive })
    .from(locationAliases)
    .where(eq(locationAliases.isActive, 1));
  console.log(JSON.stringify({ ok: true, upserted, venues: aliases.filter(row => OFFICIAL_VENUES.some(venue => venue.alias === row.alias)) }, null, 2));
}
