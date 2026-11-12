import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { products, productVariants } from './catalog'
import { customerProfiles } from './users'

export const wishlists = sqliteTable('wishlists', {
  id: text('id').primaryKey(),
  guestToken: text('guest_token'),
  customerProfileId: text('customer_profile_id').references(() => customerProfiles.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('wishlists_guest_token_unique').on(table.guestToken),
  index('wishlists_customer_profile_id_idx').on(table.customerProfileId),
]))

export const wishlistItems = sqliteTable('wishlist_items', {
  id: text('id').primaryKey(),
  wishlistId: text('wishlist_id').notNull().references(() => wishlists.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: text('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('wishlist_items_wishlist_id_idx').on(table.wishlistId),
  uniqueIndex('wishlist_items_wishlist_product_variant_unique').on(table.wishlistId, table.productId, table.variantId),
]))
