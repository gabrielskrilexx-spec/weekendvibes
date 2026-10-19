CREATE TABLE `catalogSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotHash` varchar(64) NOT NULL,
	`generatedAt` timestamp NOT NULL,
	`sourceCount` int NOT NULL,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalogSnapshots_id` PRIMARY KEY(`id`)
);
