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
	`scheduleTaskUid` varchar(65),
	`lastSuccessAt` timestamp,
	`lastStatus` enum('never','succeeded','failed','skipped') NOT NULL DEFAULT 'never',
	`lastMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestionSources_id` PRIMARY KEY(`id`),
	CONSTRAINT `ingestionSources_sourceKey_unique` UNIQUE(`sourceKey`)
);
