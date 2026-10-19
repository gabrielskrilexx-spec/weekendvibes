CREATE TABLE IF NOT EXISTS "ingestionLeases" (
  "lockKey" varchar(160) PRIMARY KEY NOT NULL,
  "holderId" varchar(120) NOT NULL,
  "leaseUntil" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
