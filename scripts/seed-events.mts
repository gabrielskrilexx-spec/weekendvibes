import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { z } from "zod";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória para o seed de eventos.");

const eventBackupSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(3).max(255),
  description: z.string().nullable().optional(),
  date: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }).nullable().optional(),
  locationId: z.string().trim().min(2).max(180),
  locationName: z.string().trim().min(2).max(255),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.enum(["Santos", "Guarujá"]),
  price: z.number().int().nonnegative(),
  priceNote: z.string().trim().max(255).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  ticketUrl: z.string().url(),
  category: z.enum(["show", "balada", "evento_musical"]),
  genre: z.enum(["funk", "house_eletronica", "samba_pagode", "rap_trap"]).nullable().optional(),
  sourceHash: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9:_-]+$/),
  sourceType: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9:_-]+$/).optional(),
}).strict();

const backupPath = resolve(process.cwd(), "server/db/seeds/events_backup.json");
const raw = JSON.parse(await readFile(backupPath, "utf8")) as unknown;
const events = z.array(eventBackupSchema).min(1).parse(raw);
const sql = postgres(databaseUrl, { prepare: false });

try {
  let imported = 0;
  for (const event of events) {
    await sql`
      INSERT INTO events (
        title, slug, description, "eventDate", "endDate", "locationName", address, city,
        category, genre, "priceCents", "priceNote", "ticketStatus", "sourceUrl", "sourceType",
        "imageUrl", "isPublished", "isArchived", "locationPrecision", "sourceHash"
      ) VALUES (
        ${event.title}, ${event.sourceHash}, ${event.description ?? null}, ${event.date}::timestamptz, ${event.endDate ?? null}::timestamptz,
        ${event.locationName}, ${event.address ?? null}, ${event.city}, ${event.category}, ${event.genre ?? null}, ${event.price},
        ${event.priceNote ?? null}, 'available', ${event.ticketUrl}, ${event.sourceType ?? "backup:local"}, ${event.imageUrl ?? null}, 1, 0, 'exact', ${event.sourceHash}
      )
      ON CONFLICT ("sourceHash") DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        "eventDate" = EXCLUDED."eventDate",
        "endDate" = EXCLUDED."endDate",
        "locationName" = EXCLUDED."locationName",
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        category = EXCLUDED.category,
        genre = EXCLUDED.genre,
        "priceCents" = EXCLUDED."priceCents",
        "priceNote" = EXCLUDED."priceNote",
        "ticketStatus" = EXCLUDED."ticketStatus",
        "sourceUrl" = EXCLUDED."sourceUrl",
        "sourceType" = EXCLUDED."sourceType",
        "imageUrl" = EXCLUDED."imageUrl",
        "isPublished" = 1,
        "isArchived" = 0,
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    imported += 1;
  }
  console.log(JSON.stringify({ ok: true, imported, backupPath, sourceType: "backup:local" }));
} finally {
  await sql.end();
}
