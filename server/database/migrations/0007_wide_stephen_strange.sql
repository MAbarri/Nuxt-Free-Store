CREATE TABLE `product_upsells` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`related_product_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_upsells_unique` ON `product_upsells` (`product_id`,`related_product_id`);--> statement-breakpoint
CREATE INDEX `product_upsells_product_id_idx` ON `product_upsells` (`product_id`);--> statement-breakpoint
ALTER TABLE `products` ADD `quantity_discount_min_qty` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `quantity_discount_percent` integer;