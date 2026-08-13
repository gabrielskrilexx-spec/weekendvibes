CREATE TABLE `locationAliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alias` varchar(180) NOT NULL,
	`canonicalName` varchar(180) NOT NULL,
	`city` varchar(100) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `locationAliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `locationAliases_alias_unique` UNIQUE(`alias`)
);
