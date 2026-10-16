CREATE TABLE `eventPriceHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`priceCents` int NOT NULL,
	`priceNote` varchar(255),
	`sourceUrl` varchar(1000),
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventPriceHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `eventPriceHistory_event_captured_idx` ON `eventPriceHistory` (`eventId`,`capturedAt`);