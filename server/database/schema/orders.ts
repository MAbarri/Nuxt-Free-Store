import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { products, productVariants } from './catalog'
import { customerProfiles } from './users'
import { shippingZones } from './shipping'

export const orderStatusValues = [
  'pending_confirmation',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'failed_delivery',
  'returned',
] as const

export const paymentStatusValues = ['unpaid', 'paid', 'refunded'] as const

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  customerProfileId: text('customer_profile_id').references(() => customerProfiles.id, { onDelete: 'set null' }),

  // Customer/delivery snapshot — captured at order time, independent of any account.
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email'),
  city: text('city').notNull(),
  addressLine: text('address_line').notNull(),
  deliveryInstructions: text('delivery_instructions'),

  shippingZoneId: text('shipping_zone_id').references(() => shippingZones.id, { onDelete: 'set null' }),

  subtotal: integer('subtotal').notNull(),
  shippingFee: integer('shipping_fee').notNull(),
  total: integer('total').notNull(),
  currency: text('currency').notNull().default('USD'),

  paymentMethod: text('payment_method', { enum: ['cod'] }).notNull().default('cod'),
  paymentStatus: text('payment_status', { enum: paymentStatusValues }).notNull().default('unpaid'),
  status: text('status', { enum: orderStatusValues }).notNull().default('pending_confirmation'),

  trackingReference: text('tracking_reference'),
  internalNotes: text('internal_notes'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('orders_order_number_unique').on(table.orderNumber),
  index('orders_customer_profile_id_idx').on(table.customerProfileId),
  index('orders_status_idx').on(table.status),
  index('orders_created_at_idx').on(table.createdAt),
  index('orders_customer_phone_idx').on(table.customerPhone),
]))

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: text('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),

  // Snapshot fields — remain accurate even if the product/variant later changes or is deleted.
  productName: text('product_name').notNull(),
  variantLabel: text('variant_label'),
  sku: text('sku').notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  subtotal: integer('subtotal').notNull(),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('order_items_order_id_idx').on(table.orderId),
]))

export const orderStatusHistory = sqliteTable('order_status_history', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status', { enum: orderStatusValues }),
  toStatus: text('to_status', { enum: orderStatusValues }).notNull(),
  note: text('note'),
  createdByUserId: text('created_by_user_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('order_status_history_order_id_idx').on(table.orderId),
]))

export const inventoryAdjustments = sqliteTable('inventory_adjustments', {
  id: text('id').primaryKey(),
  variantId: text('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  changeQty: integer('change_qty').notNull(), // positive = stock added, negative = stock removed
  resultingStock: integer('resulting_stock').notNull(),
  reason: text('reason', { enum: ['order_placed', 'order_cancelled', 'manual_adjustment', 'restock'] }).notNull(),
  note: text('note'),
  orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
  createdByUserId: text('created_by_user_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('inventory_adjustments_variant_id_idx').on(table.variantId),
]))
