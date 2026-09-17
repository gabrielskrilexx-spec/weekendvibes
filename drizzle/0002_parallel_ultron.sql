CREATE TABLE `manualReviewAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`manualReviewEventId` int NOT NULL,
	`action` enum('edited','approved','rejected','undone') NOT NULL,
	`changedFieldsJson` text NOT NULL,
	`beforeJson` text NOT NULL,
	`afterJson` text NOT NULL,
	`changedByOpenId` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manualReviewAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `manualReviewAuditLogs_event_created_idx` ON `manualReviewAuditLogs` (`manualReviewEventId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `manualReviewAuditLogs_actor_created_idx` ON `manualReviewAuditLogs` (`changedByOpenId`,`createdAt`);