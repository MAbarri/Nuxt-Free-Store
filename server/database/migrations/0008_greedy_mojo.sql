CREATE TABLE `ad_creatives` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`image_url` text,
	`platform` text NOT NULL,
	`locale` text NOT NULL,
	`design_type_id` text NOT NULL,
	`design_type_label` text NOT NULL,
	`extra_notes` text,
	`image_instructions` text,
	`headline` text NOT NULL,
	`primary_text` text NOT NULL,
	`description` text,
	`cta_label` text NOT NULL,
	`badge_text` text,
	`cost` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ad_creatives_created_at_idx` ON `ad_creatives` (`created_at`);--> statement-breakpoint
ALTER TABLE `social_posts` ADD `headline` text;--> statement-breakpoint
ALTER TABLE `social_posts` ADD `overlay_text` text;