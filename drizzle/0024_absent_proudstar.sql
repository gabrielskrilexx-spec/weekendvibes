CREATE TABLE `exportJobsAlertSettingsAudit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`environment` enum('development','preview','production') NOT NULL,
	`previousValue` text NOT NULL,
	`nextValue` text NOT NULL,
	`changedByOpenId` varchar(160) NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exportJobsAlertSettingsAudit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `export_jobs_alert_settings_audit_env_time_idx` ON `exportJobsAlertSettingsAudit` (`environment`,`changedAt`);--> statement-breakpoint
CREATE INDEX `export_jobs_alert_settings_audit_actor_idx` ON `exportJobsAlertSettingsAudit` (`changedByOpenId`,`changedAt`);