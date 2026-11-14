CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`image_url` text,
	`platform` text NOT NULL,
	`locale` text NOT NULL,
	`prompt_type_id` text NOT NULL,
	`prompt_type_label` text NOT NULL,
	`extra_notes` text,
	`caption` text NOT NULL,
	`hashtags` text NOT NULL,
	`cost` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `social_posts_created_at_idx` ON `social_posts` (`created_at`);