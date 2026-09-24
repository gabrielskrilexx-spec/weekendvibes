CREATE TABLE `apifyProcessedItems` (
	`itemFingerprint` varchar(64) NOT NULL,
	`providerItemId` varchar(255),
	`routine` varchar(64) NOT NULL,
	`mediaUrl` varchar(1000),
	`actorRunId` varchar(160),
	`status` enum('processing','completed') NOT NULL DEFAULT 'processing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `apifyProcessedItems_itemFingerprint` PRIMARY KEY(`itemFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `rateLimitBuckets` (
	`bucketKey` varchar(255) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`resetAt` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rateLimitBuckets_bucketKey` PRIMARY KEY(`bucketKey`)
);
--> statement-breakpoint
CREATE INDEX `apifyProcessedItems_provider_routine_idx` ON `apifyProcessedItems` (`providerItemId`,`routine`);--> statement-breakpoint
CREATE INDEX `ingestionRuns_routine_started_idx` ON `ingestionRuns` (`routine`,`startedAt`);--> statement-breakpoint
CREATE INDEX `operationalAlerts_resolved_created_idx` ON `operationalAlerts` (`isResolved`,`createdAt`);