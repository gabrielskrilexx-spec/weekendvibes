INSERT INTO "ingestionSources" ("sourceKey", "name", "kind", "handle", "url", "isEnabled", "priority", "frequencyMinutes", "p95LatencyThresholdMs")
VALUES
  ('public:gandaya', 'Gandaya', 'public', NULL, 'https://gandaya.dance/', 1, 50, 1440, 20000),
  ('instagram:plantssantos', 'Plants', 'instagram', 'plantssantos', 'https://www.instagram.com/plantssantos/', 1, 50, 10080, 20000)
ON CONFLICT ("sourceKey") DO UPDATE SET
  "name" = EXCLUDED."name",
  "handle" = EXCLUDED."handle",
  "url" = EXCLUDED."url",
  "isEnabled" = 1,
  "updatedAt" = now();

INSERT INTO "monitoredBrands" ("slug", "name", "cities", "platforms", "matchTerms", "isActive", "updatedAt")
VALUES ('plants-santos', 'Plants', ARRAY['Santos','Guarujá','São Vicente','Praia Grande','Cubatão'], ARRAY['Instagram'], ARRAY['Plants','plantssantos','@plantssantos'], 1, now())
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "cities" = EXCLUDED."cities",
  "platforms" = EXCLUDED."platforms",
  "matchTerms" = EXCLUDED."matchTerms",
  "isActive" = 1,
  "updatedAt" = now();
