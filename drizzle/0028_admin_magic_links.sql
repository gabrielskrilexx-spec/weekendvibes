CREATE TABLE IF NOT EXISTS "adminMagicLinks" (
  "id" serial PRIMARY KEY NOT NULL,
  "tokenHash" varchar(64) NOT NULL,
  "openId" varchar(160) NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "adminMagicLinks_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adminMagicLinks_active_token_idx" ON "adminMagicLinks" USING btree ("tokenHash", "expiresAt", "usedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adminMagicLinks_expiry_idx" ON "adminMagicLinks" USING btree ("expiresAt");
