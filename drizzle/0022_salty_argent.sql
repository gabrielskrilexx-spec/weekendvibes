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
	CONSTRAINT `filteredStoryExportJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `filteredStoryExportJobs_status_updated_idx` ON `filteredStoryExportJobs` (`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `filteredStoryExportJobs_expiry_idx` ON `filteredStoryExportJobs` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `filteredStoryExportJobs_owner_created_idx` ON `filteredStoryExportJobs` (`createdByOpenId`,`createdAt`);