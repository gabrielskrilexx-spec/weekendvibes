CREATE TABLE `systemHealthTransitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`previousStatus` enum('healthy','degraded','critical'),
	`nextStatus` enum('healthy','degraded','critical') NOT NULL,
	`reason` varchar(500) NOT NULL,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `systemHealthTransitions_id` PRIMARY KEY(`id`)
);
