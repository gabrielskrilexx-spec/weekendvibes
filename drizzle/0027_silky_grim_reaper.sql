CREATE TABLE `heartbeatExecutionEvents` (
	`id` varchar(128) NOT NULL,
	`heartbeatExecutionId` varchar(160) NOT NULL,
	`eventType` enum('started','step','log','alert','completed','failed','timeout') NOT NULL,
	`sequence` int NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`durationMs` int,
	`status` varchar(64),
	`message` text,
	`metadataJson` text,
	CONSTRAINT `heartbeatExecutionEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `heartbeatExecutionEvents_execution_sequence_idx` ON `heartbeatExecutionEvents` (`heartbeatExecutionId`,`sequence`);--> statement-breakpoint
CREATE INDEX `heartbeatExecutionEvents_execution_timestamp_idx` ON `heartbeatExecutionEvents` (`heartbeatExecutionId`,`timestamp`);