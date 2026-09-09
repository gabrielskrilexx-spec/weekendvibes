CREATE TABLE `appSettings` (
	`key` varchar(120) NOT NULL,
	`value` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `eventFavorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventFavorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `eventFavorites_user_event_unique` UNIQUE(`userId`,`eventId`)
);
--> statement-breakpoint
CREATE TABLE `eventReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` int NOT NULL,
	`hoursBefore` int NOT NULL DEFAULT 24,
	`remindAt` timestamp NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventReminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `eventReminders_user_event_unique` UNIQUE(`userId`,`eventId`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`eventDate` timestamp NOT NULL,
	`endDate` timestamp,
	`locationName` varchar(255) NOT NULL,
	`address` varchar(500),
	`neighborhood` varchar(160),
	`formattedAddress` varchar(500),
	`city` varchar(100) NOT NULL,
	`category` enum('show','balada','evento_musical') NOT NULL,
	`genre` varchar(80),
	`priceCents` int NOT NULL DEFAULT 0,
	`priceNote` varchar(255),
	`ticketStatus` enum('available','sold_out','unknown') NOT NULL DEFAULT 'unknown',
	`sourceUrl` varchar(1000),
	`sourceType` varchar(64),
	`imageUrl` varchar(1000),
	`latitude` varchar(32),
	`longitude` varchar(32),
	`locationPrecision` varchar(24) NOT NULL DEFAULT 'exact',
	`sourceHash` varchar(64),
	`isPublished` int NOT NULL DEFAULT 1,
	`isArchived` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `events_sourceHash_unique` UNIQUE(`sourceHash`)
);
--> statement-breakpoint
CREATE TABLE `exportAlertEvaluationSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`environment` enum('development','preview','production') NOT NULL,
	`windowStartedAt` timestamp NOT NULL,
	`windowEndedAt` timestamp NOT NULL,
	`queueSize` int NOT NULL,
	`previousQueueSize` int NOT NULL,
	`queueGrowth` int NOT NULL,
	`expiredLeases` int NOT NULL,
	`orphanedJobs` int NOT NULL,
	`growthThreshold` int NOT NULL,
	`minimumQueueSize` int NOT NULL,
	`consecutiveWindows` int NOT NULL,
	`severity` enum('INFO','WARNING','CRITICAL') NOT NULL,
	`decision` enum('NO_ALERT','ALERT_CREATED','DEDUPLICATED') NOT NULL,
	`evaluatedByOpenId` varchar(160) NOT NULL,
	`heartbeatExecutionId` varchar(160),
	`evaluatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exportAlertEvaluationSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exportJobsAlertSettingsAudit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`environment` enum('development','preview','production') NOT NULL,
	`previousValue` text NOT NULL,
	`nextValue` text NOT NULL,
	`changedByOpenId` varchar(160) NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exportJobsAlertSettingsAudit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `filteredStoryExportJobs` (
	`id` varchar(128) NOT NULL,
	`format` enum('csv','json') NOT NULL,
	`status` enum('queued','processing','completed','failed','cancelled','expired') NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`filtersJson` text NOT NULL,
	`fileKey` varchar(512),
	`fileName` varchar(180),
	`contentType` varchar(120),
	`errorMessage` varchar(500),
	`createdByOpenId` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`cancelledAt` timestamp,
	`leaseOwner` varchar(128),
	`leaseExpiresAt` timestamp,
	`recoveryAttempts` int NOT NULL DEFAULT 0,
	`lastRecoveredAt` timestamp,
	`fileDeletePending` int NOT NULL DEFAULT false,
	`fileDeletedAt` timestamp,
	CONSTRAINT `filteredStoryExportJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geocodingAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`city` varchar(100) NOT NULL,
	`rawAddress` varchar(500),
	`normalizedAddress` varchar(500),
	`status` enum('invalid','fallback','rejected','succeeded') NOT NULL,
	`message` varchar(1000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geocodingAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geocodingJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`addressHash` varchar(64) NOT NULL,
	`status` enum('pending','processing','succeeded','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`provider` varchar(64),
	`confidence` varchar(32),
	`lastError` text,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `geocodingJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `geocodingJobs_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `heartbeatExecutionEvents` (
	`id` varchar(128) NOT NULL,
	`heartbeatExecutionId` varchar(160) NOT NULL,
	`eventType` enum('started','step','log','alert','completed','failed','timeout') NOT NULL,
	`sequence` int NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`durationMs` int,
	`status` varchar(64),
	`message` text,
	`metadataJson` text,
	CONSTRAINT `heartbeatExecutionEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingestionPayloadCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(255) NOT NULL,
	`sourceKey` varchar(120) NOT NULL,
	`sourceUrl` varchar(1000) NOT NULL,
	`payload` text NOT NULL,
	`latitude` varchar(32),
	`longitude` varchar(32),
	`lastGoodAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestionPayloadCache_id` PRIMARY KEY(`id`),
	CONSTRAINT `ingestionPayloadCache_cacheKey_unique` UNIQUE(`cacheKey`)
);
--> statement-breakpoint
CREATE TABLE `ingestionRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routine` varchar(64) NOT NULL,
	`sourceKey` varchar(255),
	`status` enum('running','succeeded','failed','partial') NOT NULL DEFAULT 'running',
	`importedCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`duration_ms` int,
	`httpStatus` int,
	`counts` text,
	`details` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `ingestionRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingestionSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(120) NOT NULL,
	`name` varchar(180) NOT NULL,
	`kind` enum('instagram','public') NOT NULL,
	`handle` varchar(180),
	`url` varchar(1000) NOT NULL,
	`isEnabled` int NOT NULL DEFAULT 1,
	`priority` int NOT NULL DEFAULT 50,
	`frequencyMinutes` int NOT NULL DEFAULT 10080,
	`p95LatencyThresholdMs` int NOT NULL DEFAULT 3000,
	`scheduleTaskUid` varchar(65),
	`lastSuccessAt` timestamp,
	`lastStatus` enum('never','succeeded','failed','skipped') NOT NULL DEFAULT 'never',
	`lastMessage` text,
	`circuitState` enum('closed','open','half_open') NOT NULL DEFAULT 'closed',
	`circuitFailureCount` int NOT NULL DEFAULT 0,
	`circuitOpenedAt` timestamp,
	`circuitNextAttemptAt` timestamp,
	`circuitLastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestionSources_id` PRIMARY KEY(`id`),
	CONSTRAINT `ingestionSources_sourceKey_unique` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
CREATE TABLE `ingestionStoryAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyId` varchar(500) NOT NULL,
	`runId` int NOT NULL,
	`action` enum('ocr_edit','approval') NOT NULL,
	`previousText` text,
	`nextText` text,
	`status` varchar(32),
	`actorOpenId` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ingestionStoryAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locationAliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alias` varchar(180) NOT NULL,
	`canonicalName` varchar(180) NOT NULL,
	`city` varchar(100) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locationAliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `locationAliases_alias_unique` UNIQUE(`alias`)
);
--> statement-breakpoint
CREATE TABLE `manualReviewEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceUrl` varchar(1000),
	`sourceType` varchar(64),
	`title` varchar(255) NOT NULL,
	`summary` text,
	`eventDate` timestamp,
	`endDate` timestamp,
	`locationName` varchar(255),
	`address` varchar(500),
	`city` varchar(100),
	`category` enum('show','balada','evento_musical'),
	`genre` varchar(80),
	`priceCents` int,
	`imageUrl` varchar(1000),
	`rawText` text,
	`reason` varchar(160) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` varchar(160),
	`reviewedAt` timestamp,
	`publishedEventId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manualReviewEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operationalAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integration` enum('meta','public','ocr','openai','pipeline') NOT NULL,
	`severity` enum('INFO','WARNING','CRITICAL') NOT NULL DEFAULT 'WARNING',
	`alertType` varchar(80) NOT NULL DEFAULT 'operational',
	`slaMinutes` int NOT NULL DEFAULT 1440,
	`runId` varchar(32),
	`title` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`isResolved` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalAlerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `operationalAlerts_fingerprint_unique` UNIQUE(`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `exportAlertEvaluationSnapshots_env_time_idx` ON `exportAlertEvaluationSnapshots` (`environment`,`evaluatedAt`);--> statement-breakpoint
CREATE INDEX `exportAlertEvaluationSnapshots_decision_time_idx` ON `exportAlertEvaluationSnapshots` (`decision`,`evaluatedAt`);--> statement-breakpoint
CREATE INDEX `exportAlertEvaluationSnapshots_heartbeat_time_idx` ON `exportAlertEvaluationSnapshots` (`heartbeatExecutionId`,`evaluatedAt`);--> statement-breakpoint
CREATE INDEX `export_jobs_alert_settings_audit_env_time_idx` ON `exportJobsAlertSettingsAudit` (`environment`,`changedAt`);--> statement-breakpoint
CREATE INDEX `export_jobs_alert_settings_audit_actor_idx` ON `exportJobsAlertSettingsAudit` (`changedByOpenId`,`changedAt`);--> statement-breakpoint
CREATE INDEX `filteredStoryExportJobs_status_updated_idx` ON `filteredStoryExportJobs` (`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `filteredStoryExportJobs_expiry_idx` ON `filteredStoryExportJobs` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `filteredStoryExportJobs_owner_created_idx` ON `filteredStoryExportJobs` (`createdByOpenId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `filteredStoryExportJobs_status_lease_idx` ON `filteredStoryExportJobs` (`status`,`leaseExpiresAt`);--> statement-breakpoint
CREATE INDEX `heartbeatExecutionEvents_execution_sequence_idx` ON `heartbeatExecutionEvents` (`heartbeatExecutionId`,`sequence`);--> statement-breakpoint
CREATE INDEX `heartbeatExecutionEvents_execution_timestamp_idx` ON `heartbeatExecutionEvents` (`heartbeatExecutionId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `manualReviewEvents_status_created_idx` ON `manualReviewEvents` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `manualReviewEvents_source_status_idx` ON `manualReviewEvents` (`sourceType`,`status`);--> statement-breakpoint
CREATE INDEX `manualReviewEvents_event_date_idx` ON `manualReviewEvents` (`eventDate`);