CREATE TABLE `apifyDailyUsage` (
	`dateKey` varchar(10) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`dailyLimit` int NOT NULL,
	`lastBlockedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apifyDailyUsage_dateKey` PRIMARY KEY(`dateKey`)
);
