ALTER TABLE `ingestionSources` ADD `consecutive403Count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestionSources` ADD `last403AlertedAt` timestamp;