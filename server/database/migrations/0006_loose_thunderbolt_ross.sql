PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_customer_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`phone` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- customer_profiles had no `phone`/`full_name`/`email` columns before this
-- migration, and the one pre-existing row (an orphaned admin test account,
-- never linked to a real order) was deleted ahead of this migration in both
-- local and production D1 — so there is nothing real to carry over. This
-- INSERT intentionally selects literal placeholders for the new NOT NULL
-- columns; since the source table is empty, zero rows are actually inserted.
INSERT INTO `__new_customer_profiles`("id", "user_id", "phone", "full_name", "email", "notes", "created_at", "updated_at") SELECT "id", "user_id", '', '', NULL, "notes", "created_at", "updated_at" FROM `customer_profiles`;--> statement-breakpoint
DROP TABLE `customer_profiles`;--> statement-breakpoint
ALTER TABLE `__new_customer_profiles` RENAME TO `customer_profiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `customer_profiles_user_id_unique` ON `customer_profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_profiles_phone_unique` ON `customer_profiles` (`phone`);