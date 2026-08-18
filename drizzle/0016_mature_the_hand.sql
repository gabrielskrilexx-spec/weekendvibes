ALTER TABLE `operationalAlerts` ADD `severity` enum('INFO','WARNING','CRITICAL') DEFAULT 'WARNING' NOT NULL;--> statement-breakpoint
ALTER TABLE `operationalAlerts` ADD `alertType` varchar(80) DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE `operationalAlerts` ADD `slaMinutes` int DEFAULT 1440 NOT NULL;--> statement-breakpoint
ALTER TABLE `operationalAlerts` ADD `runId` varchar(32);