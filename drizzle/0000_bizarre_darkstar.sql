CREATE TABLE `user_sheets` (
	`sheet_id` text PRIMARY KEY NOT NULL,
	`user_email` text,
	`sheet_name` text,
	`spreadsheet_id` text,
	`role` text,
	`created_by` text,
	`last_accessed` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_email` ON `user_sheets` (`user_email`);--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
