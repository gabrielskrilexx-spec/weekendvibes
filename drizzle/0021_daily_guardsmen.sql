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
