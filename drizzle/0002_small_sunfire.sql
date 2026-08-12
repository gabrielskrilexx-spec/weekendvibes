ALTER TABLE `events` MODIFY COLUMN `category` enum('show','balada','evento_musical') NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `genre` varchar(80);