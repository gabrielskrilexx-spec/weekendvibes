CREATE TABLE IF NOT EXISTS "monitoredBrands" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" varchar(160) NOT NULL,
  "name" varchar(160) NOT NULL,
  "cities" text[] DEFAULT '{}'::text[] NOT NULL,
  "platforms" text[] DEFAULT '{}'::text[] NOT NULL,
  "matchTerms" text[] DEFAULT '{}'::text[] NOT NULL,
  "isActive" integer DEFAULT 1 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "monitoredBrands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monitoredBrands_active_idx" ON "monitoredBrands" USING btree ("isActive");
--> statement-breakpoint
INSERT INTO "monitoredBrands" ("slug", "name", "cities", "platforms", "matchTerms", "isActive", "updatedAt") VALUES
  ('nosso-after', 'Nosso After', ARRAY['Guarujá','Santos'], ARRAY['Instagram','Bilheterias itinerantes'], ARRAY['Nosso After','NossoAfter','nossoafterguaruja'], 1, now()),
  ('plants-santos', 'Plants Santos', ARRAY['Santos'], ARRAY['Sympla','Ingresse'], ARRAY['Plants Santos','PlantsSantos'], 1, now()),
  ('the-crew', 'The Crew', ARRAY['Santos'], ARRAY['ArTicket'], ARRAY['The Crew','The Crew Apresenta'], 1, now()),
  ('pandance', 'PANDANCE', ARRAY['Santos'], ARRAY['ArTicket'], ARRAY['PANDANCE','Pandance'], 1, now()),
  ('mimada-festa', 'Mimada Festa', ARRAY['Santos','Guarujá'], ARRAY['Zig','Sympla'], ARRAY['Mimada Festa','MimadaFesta'], 1, now())
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "cities" = EXCLUDED."cities",
  "platforms" = EXCLUDED."platforms",
  "matchTerms" = EXCLUDED."matchTerms",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = now();
