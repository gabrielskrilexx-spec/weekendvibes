CREATE TABLE `ingestionSourceActionAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(120) NOT NULL,
	`action` enum('reactivated') NOT NULL,
	`operatorOpenId` varchar(160),
	`details` varchar(500),
	`actedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ingestionSourceActionAuditLogs_id` PRIMARY KEY(`id`)
);
