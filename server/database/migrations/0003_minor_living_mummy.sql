PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`short_description` text,
	`sku` text NOT NULL,
	`base_price` integer NOT NULL,
	`compare_at_price` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`size_guide_id` text,
	`layout_style` text DEFAULT 'landing' NOT NULL,
	`landing_benefits` text,
	`landing_blocks` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`size_guide_id`) REFERENCES `size_guides`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "slug", "description", "short_description", "sku", "base_price", "compare_at_price", "status", "is_featured", "seo_title", "seo_description", "size_guide_id", "layout_style", "landing_benefits", "landing_blocks", "created_at", "updated_at", "deleted_at") SELECT "id", "name", "slug", "description", "short_description", "sku", "base_price", "compare_at_price", "status", "is_featured", "seo_title", "seo_description", "size_guide_id", "layout_style", "landing_benefits", "landing_blocks", "created_at", "updated_at", "deleted_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);