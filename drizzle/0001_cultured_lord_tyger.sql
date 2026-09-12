ALTER TABLE `ingestionSources` ADD `lastHttpStatus` int;--> statement-breakpoint
ALTER TABLE `ingestionSources` ADD `lastFailureReason` varchar(500);