CREATE TABLE `ingestionSourceHandleAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(120) NOT NULL,
	`previousHandle` varchar(180),
	`nextHandle` varchar(180),
	`changedByOpenId` varchar(160),
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ingestionSourceHandleAuditLogs_id` PRIMARY KEY(`id`)
);
