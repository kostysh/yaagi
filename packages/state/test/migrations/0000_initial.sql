CREATE TABLE `fixture_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`revision` integer NOT NULL,
	`bytes` blob NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fixture_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`noteId` text NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`noteId`) REFERENCES `fixture_notes`(`id`) ON UPDATE no action ON DELETE no action
);
