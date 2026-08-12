CREATE TABLE `eventFavorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventFavorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `eventFavorites_user_event_unique` UNIQUE(`userId`,`eventId`)
);
--> statement-breakpoint
CREATE TABLE `eventReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` int NOT NULL,
	`hoursBefore` int NOT NULL DEFAULT 24,
	`remindAt` timestamp NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventReminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `eventReminders_user_event_unique` UNIQUE(`userId`,`eventId`)
);
