CREATE TABLE `ingestionPayloadCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(255) NOT NULL,
	`sourceKey` varchar(120) NOT NULL,
	`sourceUrl` varchar(1000) NOT NULL,
	`payload` text NOT NULL,
	`latitude` varchar(32),
	`longitude` varchar(32),
	`lastGoodAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestionPayloadCache_id` PRIMARY KEY(`id`),
	CONSTRAINT `ingestionPayloadCache_cacheKey_unique` UNIQUE(`cacheKey`)
);
