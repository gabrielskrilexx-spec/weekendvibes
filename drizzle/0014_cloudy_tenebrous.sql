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
ALTER TABLE `events` ADD `neighborhood` varchar(160);--> statement-breakpoint
ALTER TABLE `events` ADD `formattedAddress` varchar(500);