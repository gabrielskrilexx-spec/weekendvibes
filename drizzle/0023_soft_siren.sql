ALTER TABLE `filteredStoryExportJobs` ADD `leaseOwner` varchar(128);--> statement-breakpoint
ALTER TABLE `filteredStoryExportJobs` ADD `leaseExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `filteredStoryExportJobs` ADD `recoveryAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `filteredStoryExportJobs` ADD `lastRecoveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `filteredStoryExportJobs` ADD `fileDeletePending` int DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `filteredStoryExportJobs` ADD `fileDeletedAt` timestamp;--> statement-breakpoint
CREATE INDEX `filteredStoryExportJobs_status_lease_idx` ON `filteredStoryExportJobs` (`status`,`leaseExpiresAt`);