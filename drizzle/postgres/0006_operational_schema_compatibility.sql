-- Compatibility guard for production instances that were provisioned from an older PostgreSQL baseline.
-- This migration is additive and idempotent: it never drops, rewrites, or deletes existing rows.
CREATE TABLE IF NOT EXISTS "ingestionRuns" (
  "id" serial PRIMARY KEY,
  "routine" varchar(64) NOT NULL,
  "sourceKey" varchar(255),
  "status" text DEFAULT 'running' NOT NULL,
  "importedCount" integer DEFAULT 0 NOT NULL,
  "failedCount" integer DEFAULT 0 NOT NULL,
  "duration_ms" integer,
  "httpStatus" integer,
  "counts" text,
  "details" text,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "finishedAt" timestamp
);
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "routine" varchar(64) DEFAULT 'unknown' NOT NULL;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "sourceKey" varchar(255);
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'running' NOT NULL;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "importedCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "failedCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "httpStatus" integer;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "counts" text;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "details" text;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "startedAt" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "ingestionRuns" ADD COLUMN IF NOT EXISTS "finishedAt" timestamp;

CREATE TABLE IF NOT EXISTS "operationalAlerts" (
  "id" serial PRIMARY KEY,
  "integration" text NOT NULL,
  "severity" text DEFAULT 'WARNING' NOT NULL,
  "alertType" varchar(80) DEFAULT 'operational' NOT NULL,
  "slaMinutes" integer DEFAULT 1440 NOT NULL,
  "runId" varchar(32),
  "title" varchar(180) NOT NULL,
  "message" text NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "isResolved" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "integration" text DEFAULT 'pipeline' NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "severity" text DEFAULT 'WARNING' NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "alertType" varchar(80) DEFAULT 'operational' NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "slaMinutes" integer DEFAULT 1440 NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "runId" varchar(32);
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "title" varchar(180) DEFAULT 'Operational alert' NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "message" text DEFAULT '' NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "fingerprint" varchar(64) DEFAULT md5(random()::text || clock_timestamp()::text) NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "isResolved" integer DEFAULT 0 NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "operationalAlerts" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "operationalAlerts_fingerprint_unique" ON "operationalAlerts" ("fingerprint");

CREATE TABLE IF NOT EXISTS "ingestionSources" (
  "id" serial PRIMARY KEY,
  "sourceKey" varchar(120) NOT NULL,
  "name" varchar(180) NOT NULL,
  "kind" text NOT NULL,
  "handle" varchar(180),
  "url" varchar(1000) NOT NULL,
  "isEnabled" integer DEFAULT 1 NOT NULL,
  "priority" integer DEFAULT 50 NOT NULL,
  "frequencyMinutes" integer DEFAULT 10080 NOT NULL,
  "p95LatencyThresholdMs" integer DEFAULT 3000 NOT NULL,
  "scheduleTaskUid" varchar(65),
  "lastAttemptAt" timestamp,
  "lastSuccessAt" timestamp,
  "lastStatus" text DEFAULT 'never' NOT NULL,
  "lastMessage" text,
  "lastExecutionFeedback" varchar(1000),
  "lastHttpStatus" integer,
  "lastFailureReason" varchar(500),
  "circuitState" text DEFAULT 'closed' NOT NULL,
  "circuitFailureCount" integer DEFAULT 0 NOT NULL,
  "circuitOpenedAt" timestamp,
  "circuitNextAttemptAt" timestamp,
  "circuitLastError" text,
  "consecutive403Count" integer DEFAULT 0 NOT NULL,
  "last403AlertedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "sourceKey" varchar(120) DEFAULT 'unknown' NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "name" varchar(180) DEFAULT 'Unknown source' NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'public' NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "handle" varchar(180);
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "url" varchar(1000) DEFAULT '' NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "isEnabled" integer DEFAULT 1 NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 50 NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "frequencyMinutes" integer DEFAULT 10080 NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "p95LatencyThresholdMs" integer DEFAULT 3000 NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "scheduleTaskUid" varchar(65);
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "lastAttemptAt" timestamp;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "lastSuccessAt" timestamp;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "lastStatus" text DEFAULT 'never' NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "lastMessage" text;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "lastExecutionFeedback" varchar(1000);
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "lastHttpStatus" integer;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "lastFailureReason" varchar(500);
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "circuitState" text DEFAULT 'closed' NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "circuitFailureCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "circuitOpenedAt" timestamp;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "circuitNextAttemptAt" timestamp;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "circuitLastError" text;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "consecutive403Count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "last403AlertedAt" timestamp;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "ingestionSources" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ingestionSources_sourceKey_unique" ON "ingestionSources" ("sourceKey");
