CREATE TABLE `operationalAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integration` enum('apify','ocr','openai','pipeline') NOT NULL,
	`title` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`isResolved` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalAlerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `operationalAlerts_fingerprint_unique` UNIQUE(`fingerprint`)
);
