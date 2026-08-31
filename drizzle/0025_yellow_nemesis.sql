CREATE TABLE `exportAlertEvaluationSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`environment` enum('development','preview','production') NOT NULL,
	`windowStartedAt` timestamp NOT NULL,
	`windowEndedAt` timestamp NOT NULL,
	`queueSize` int NOT NULL,
	`previousQueueSize` int NOT NULL,
	`queueGrowth` int NOT NULL,
	`expiredLeases` int NOT NULL,
	`orphanedJobs` int NOT NULL,
	`growthThreshold` int NOT NULL,
	`minimumQueueSize` int NOT NULL,
	`consecutiveWindows` int NOT NULL,
	`severity` enum('INFO','WARNING','CRITICAL') NOT NULL,
	`decision` enum('NO_ALERT','ALERT_CREATED','DEDUPLICATED') NOT NULL,
	`evaluatedByOpenId` varchar(160) NOT NULL,
	`evaluatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exportAlertEvaluationSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `exportAlertEvaluationSnapshots_env_time_idx` ON `exportAlertEvaluationSnapshots` (`environment`,`evaluatedAt`);--> statement-breakpoint
CREATE INDEX `exportAlertEvaluationSnapshots_decision_time_idx` ON `exportAlertEvaluationSnapshots` (`decision`,`evaluatedAt`);