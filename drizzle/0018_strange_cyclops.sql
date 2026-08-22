ALTER TABLE `ingestionSources` ADD `circuitState` enum('closed','open','half_open') DEFAULT 'closed' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestionSources` ADD `circuitFailureCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestionSources` ADD `circuitOpenedAt` timestamp;--> statement-breakpoint
ALTER TABLE `ingestionSources` ADD `circuitNextAttemptAt` timestamp;--> statement-breakpoint
ALTER TABLE `ingestionSources` ADD `circuitLastError` text;