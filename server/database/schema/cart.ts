import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { products, productVariants } from './catalog'
import { customerProfiles } from './users'

export const carts = sqliteTable('carts', {
  id: text('id').primaryKey(),
  guestToken: text('guest_token'),
  customerProfileId: text('customer_profile_id').references(() => customerProfiles.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['active', 'converted', 'abandoned'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('carts_guest_token_unique').on(table.guestToken),
  index('carts_customer_profile_id_idx').on(table.customerProfileId),
]))

export const cartItems = sqliteTable('cart_items', {
  id: text('id').primaryKey(),
  cartId: text('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: text('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('cart_items_cart_id_idx').on(table.cartId),
  uniqueIndex('cart_items_cart_product_variant_unique').on(table.cartId, table.productId, table.variantId),
]))
