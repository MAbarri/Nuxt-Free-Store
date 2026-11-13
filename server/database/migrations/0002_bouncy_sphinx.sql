CREATE TABLE `category_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_translations_unique` ON `category_translations` (`category_id`,`locale`);--> statement-breakpoint
CREATE INDEX `category_translations_category_id_idx` ON `category_translations` (`category_id`);--> statement-breakpoint
CREATE TABLE `product_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text,
	`short_description` text,
	`description` text,
	`seo_title` text,
	`seo_description` text,
	`landing_benefits` text,
	`landing_block_captions` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_translations_unique` ON `product_translations` (`product_id`,`locale`);--> statement-breakpoint
CREATE INDEX `product_translations_product_id_idx` ON `product_translations` (`product_id`);