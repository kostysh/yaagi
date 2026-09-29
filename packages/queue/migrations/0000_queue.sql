CREATE TABLE `queue_jobs` (
	`namespace` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`not_before` integer NOT NULL,
	`locked_at` integer,
	`body` text NOT NULL,
	PRIMARY KEY(`namespace`, `id`)
);
--> statement-breakpoint
CREATE INDEX `queue_due` ON `queue_jobs` (`namespace`,`name`,`version`,`status`,`not_before`);