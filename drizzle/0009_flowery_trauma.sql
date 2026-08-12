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
CREATE TABLE `ingestionRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routine` varchar(64) NOT NULL,
	`sourceKey` varchar(255),
	`status` enum('running','succeeded','failed','partial') NOT NULL DEFAULT 'running',
	`importedCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`details` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `ingestionRuns_id` PRIMARY KEY(`id`)
);
