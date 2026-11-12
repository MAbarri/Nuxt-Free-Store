import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const shippingZones = sqliteTable('shipping_zones', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  freeShippingThreshold: integer('free_shipping_threshold'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// One rate per destination city/region within a zone. Disabling a rate disables that destination.
export const shippingRates = sqliteTable('shipping_rates', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => shippingZones.id, { onDelete: 'cascade' }),
  city: text('city').notNull(),
  fee: integer('fee').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('shipping_rates_zone_id_idx').on(table.zoneId),
  index('shipping_rates_city_idx').on(table.city),
]))
