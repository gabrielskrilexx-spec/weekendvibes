CREATE TABLE "adminMagicLinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"openId" varchar(160) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "adminMagicLinks_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "apifyDailyUsage" (
	"dateKey" varchar(10) PRIMARY KEY NOT NULL,
	"requestCount" integer DEFAULT 0 NOT NULL,
	"dailyLimit" integer NOT NULL,
	"lastBlockedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apifyProcessedItems" (
	"itemFingerprint" varchar(64) PRIMARY KEY NOT NULL,
	"providerItemId" varchar(255),
	"routine" varchar(64) NOT NULL,
	"mediaUrl" varchar(1000),
	"actorRunId" varchar(160),
	"status" text DEFAULT 'processing' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "appSettings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalogSnapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshotHash" varchar(64) NOT NULL,
	"generatedAt" timestamp NOT NULL,
	"sourceCount" integer NOT NULL,
	"payloadJson" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventFavorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"eventId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventPriceHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"priceCents" integer NOT NULL,
	"priceNote" varchar(255),
	"sourceUrl" varchar(1000),
	"capturedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventReminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"eventId" integer NOT NULL,
	"hoursBefore" integer DEFAULT 24 NOT NULL,
	"remindAt" timestamp NOT NULL,
	"isActive" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"eventDate" timestamp NOT NULL,
	"endDate" timestamp,
	"locationName" varchar(255) NOT NULL,
	"address" varchar(500),
	"neighborhood" varchar(160),
	"formattedAddress" varchar(500),
	"city" varchar(100) NOT NULL,
	"category" text NOT NULL,
	"genre" varchar(80),
	"priceCents" integer DEFAULT 0 NOT NULL,
	"priceNote" varchar(255),
	"ticketStatus" text DEFAULT 'unknown' NOT NULL,
	"sourceUrl" varchar(1000),
	"sourceType" varchar(64),
	"imageUrl" varchar(1000),
	"latitude" varchar(32),
	"longitude" varchar(32),
	"locationPrecision" varchar(24) DEFAULT 'exact' NOT NULL,
	"sourceHash" varchar(64),
	"isPublished" integer DEFAULT 1 NOT NULL,
	"isArchived" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_sourceHash_unique" UNIQUE("sourceHash")
);
--> statement-breakpoint
CREATE TABLE "exportAlertEvaluationSnapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"windowStartedAt" timestamp NOT NULL,
	"windowEndedAt" timestamp NOT NULL,
	"queueSize" integer NOT NULL,
	"previousQueueSize" integer NOT NULL,
	"queueGrowth" integer NOT NULL,
	"expiredLeases" integer NOT NULL,
	"orphanedJobs" integer NOT NULL,
	"growthThreshold" integer NOT NULL,
	"minimumQueueSize" integer NOT NULL,
	"consecutiveWindows" integer NOT NULL,
	"severity" text NOT NULL,
	"decision" text NOT NULL,
	"evaluatedByOpenId" varchar(160) NOT NULL,
	"heartbeatExecutionId" varchar(160),
	"evaluatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exportJobsAlertSettingsAudit" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"previousValue" text NOT NULL,
	"nextValue" text NOT NULL,
	"changedByOpenId" varchar(160) NOT NULL,
	"changedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filteredStoryExportJobs" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"format" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"filtersJson" text NOT NULL,
	"fileKey" varchar(512),
	"fileName" varchar(180),
	"contentType" varchar(120),
	"errorMessage" varchar(500),
	"createdByOpenId" varchar(160) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"completedAt" timestamp,
	"cancelledAt" timestamp,
	"leaseOwner" varchar(128),
	"leaseExpiresAt" timestamp,
	"recoveryAttempts" integer DEFAULT 0 NOT NULL,
	"lastRecoveredAt" timestamp,
	"fileDeletePending" integer DEFAULT 0 NOT NULL,
	"fileDeletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "geocodingAuditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"city" varchar(100) NOT NULL,
	"rawAddress" varchar(500),
	"normalizedAddress" varchar(500),
	"status" text NOT NULL,
	"message" varchar(1000) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geocodingJobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"addressHash" varchar(64) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider" varchar(64),
	"confidence" varchar(32),
	"lastError" text,
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "geocodingJobs_eventId_unique" UNIQUE("eventId")
);
--> statement-breakpoint
CREATE TABLE "heartbeatExecutionEvents" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"heartbeatExecutionId" varchar(160) NOT NULL,
	"eventType" text NOT NULL,
	"sequence" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"durationMs" integer,
	"status" varchar(64),
	"message" text,
	"metadataJson" text
);
--> statement-breakpoint
CREATE TABLE "ingestionLeases" (
	"lockKey" varchar(160) PRIMARY KEY NOT NULL,
	"holderId" varchar(120) NOT NULL,
	"leaseUntil" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestionPayloadCache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cacheKey" varchar(255) NOT NULL,
	"sourceKey" varchar(120) NOT NULL,
	"sourceUrl" varchar(1000) NOT NULL,
	"payload" text NOT NULL,
	"latitude" varchar(32),
	"longitude" varchar(32),
	"lastGoodAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingestionPayloadCache_cacheKey_unique" UNIQUE("cacheKey")
);
--> statement-breakpoint
CREATE TABLE "ingestionRuns" (
	"id" serial PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "ingestionSourceActionAuditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sourceKey" varchar(120) NOT NULL,
	"action" text NOT NULL,
	"operatorOpenId" varchar(160),
	"details" varchar(500),
	"actedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestionSourceHandleAuditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sourceKey" varchar(120) NOT NULL,
	"previousHandle" varchar(180),
	"nextHandle" varchar(180),
	"changedByOpenId" varchar(160),
	"changedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestionSources" (
	"id" serial PRIMARY KEY NOT NULL,
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
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingestionSources_sourceKey_unique" UNIQUE("sourceKey")
);
--> statement-breakpoint
CREATE TABLE "ingestionStoryAuditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"storyId" varchar(500) NOT NULL,
	"runId" integer NOT NULL,
	"action" text NOT NULL,
	"previousText" text,
	"nextText" text,
	"status" varchar(32),
	"actorOpenId" varchar(160) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locationAliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"alias" varchar(180) NOT NULL,
	"canonicalName" varchar(180) NOT NULL,
	"city" varchar(100) NOT NULL,
	"isActive" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "locationAliases_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
CREATE TABLE "manualReviewAuditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"manualReviewEventId" integer NOT NULL,
	"action" text NOT NULL,
	"changedFieldsJson" text NOT NULL,
	"beforeJson" text NOT NULL,
	"afterJson" text NOT NULL,
	"changedByOpenId" varchar(160) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manualReviewEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"sourceUrl" varchar(1000),
	"sourceType" varchar(64),
	"title" varchar(255) NOT NULL,
	"summary" text,
	"eventDate" timestamp,
	"endDate" timestamp,
	"locationName" varchar(255),
	"address" varchar(500),
	"city" varchar(100),
	"category" text,
	"genre" varchar(80),
	"priceCents" integer,
	"imageUrl" varchar(1000),
	"rawText" text,
	"reason" varchar(160) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewedBy" varchar(160),
	"reviewedAt" timestamp,
	"publishedEventId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operationalAlerts" (
	"id" serial PRIMARY KEY NOT NULL,
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
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "operationalAlerts_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "rateLimitBuckets" (
	"bucketKey" varchar(255) PRIMARY KEY NOT NULL,
	"requestCount" integer DEFAULT 0 NOT NULL,
	"resetAt" timestamp NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "systemHealthTransitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"previousStatus" text,
	"nextStatus" text NOT NULL,
	"reason" varchar(500) NOT NULL,
	"observedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "adminMagicLinks_active_token_idx" ON "adminMagicLinks" USING btree ("tokenHash","expiresAt","usedAt");--> statement-breakpoint
CREATE INDEX "adminMagicLinks_expiry_idx" ON "adminMagicLinks" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "apifyProcessedItems_provider_routine_idx" ON "apifyProcessedItems" USING btree ("providerItemId","routine");--> statement-breakpoint
CREATE INDEX "catalogSnapshots_created_idx" ON "catalogSnapshots" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "eventFavorites_user_event_unique" ON "eventFavorites" USING btree ("userId","eventId");--> statement-breakpoint
CREATE INDEX "eventPriceHistory_event_captured_idx" ON "eventPriceHistory" USING btree ("eventId","capturedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "eventReminders_user_event_unique" ON "eventReminders" USING btree ("userId","eventId");--> statement-breakpoint
CREATE INDEX "events_published_archived_date_idx" ON "events" USING btree ("isPublished","isArchived","eventDate");--> statement-breakpoint
CREATE INDEX "exportAlertEvaluationSnapshots_env_time_idx" ON "exportAlertEvaluationSnapshots" USING btree ("environment","evaluatedAt");--> statement-breakpoint
CREATE INDEX "exportAlertEvaluationSnapshots_decision_time_idx" ON "exportAlertEvaluationSnapshots" USING btree ("decision","evaluatedAt");--> statement-breakpoint
CREATE INDEX "exportAlertEvaluationSnapshots_heartbeat_time_idx" ON "exportAlertEvaluationSnapshots" USING btree ("heartbeatExecutionId","evaluatedAt");--> statement-breakpoint
CREATE INDEX "export_jobs_alert_settings_audit_env_time_idx" ON "exportJobsAlertSettingsAudit" USING btree ("environment","changedAt");--> statement-breakpoint
CREATE INDEX "export_jobs_alert_settings_audit_actor_idx" ON "exportJobsAlertSettingsAudit" USING btree ("changedByOpenId","changedAt");--> statement-breakpoint
CREATE INDEX "filteredStoryExportJobs_status_updated_idx" ON "filteredStoryExportJobs" USING btree ("status","updatedAt");--> statement-breakpoint
CREATE INDEX "filteredStoryExportJobs_expiry_idx" ON "filteredStoryExportJobs" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "filteredStoryExportJobs_owner_created_idx" ON "filteredStoryExportJobs" USING btree ("createdByOpenId","createdAt");--> statement-breakpoint
CREATE INDEX "filteredStoryExportJobs_status_lease_idx" ON "filteredStoryExportJobs" USING btree ("status","leaseExpiresAt");--> statement-breakpoint
CREATE INDEX "heartbeatExecutionEvents_execution_sequence_idx" ON "heartbeatExecutionEvents" USING btree ("heartbeatExecutionId","sequence");--> statement-breakpoint
CREATE INDEX "heartbeatExecutionEvents_execution_timestamp_idx" ON "heartbeatExecutionEvents" USING btree ("heartbeatExecutionId","timestamp");--> statement-breakpoint
CREATE INDEX "ingestionRuns_routine_started_idx" ON "ingestionRuns" USING btree ("routine","startedAt");--> statement-breakpoint
CREATE INDEX "ingestionRuns_source_started_idx" ON "ingestionRuns" USING btree ("sourceKey","startedAt");--> statement-breakpoint
CREATE INDEX "ingestionSourceActionAuditLogs_source_acted_idx" ON "ingestionSourceActionAuditLogs" USING btree ("sourceKey","actedAt");--> statement-breakpoint
CREATE INDEX "ingestionSourceHandleAuditLogs_source_changed_idx" ON "ingestionSourceHandleAuditLogs" USING btree ("sourceKey","changedAt");--> statement-breakpoint
CREATE INDEX "ingestionStoryAuditLogs_story_created_idx" ON "ingestionStoryAuditLogs" USING btree ("storyId","createdAt");--> statement-breakpoint
CREATE INDEX "manualReviewAuditLogs_event_created_idx" ON "manualReviewAuditLogs" USING btree ("manualReviewEventId","createdAt");--> statement-breakpoint
CREATE INDEX "manualReviewAuditLogs_actor_created_idx" ON "manualReviewAuditLogs" USING btree ("changedByOpenId","createdAt");--> statement-breakpoint
CREATE INDEX "manualReviewEvents_status_created_idx" ON "manualReviewEvents" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "manualReviewEvents_source_status_idx" ON "manualReviewEvents" USING btree ("sourceType","status");--> statement-breakpoint
CREATE INDEX "manualReviewEvents_event_date_idx" ON "manualReviewEvents" USING btree ("eventDate");--> statement-breakpoint
CREATE INDEX "operationalAlerts_resolved_created_idx" ON "operationalAlerts" USING btree ("isResolved","createdAt");--> statement-breakpoint
CREATE INDEX "systemHealthTransitions_observed_idx" ON "systemHealthTransitions" USING btree ("observedAt");