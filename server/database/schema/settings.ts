import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Simple key-value store for store-wide, non-sensitive configuration
// (branding, placeholder colors, default shipping fee, etc.). Values are
// stored as JSON text and parsed by the settings service.
export const storeSettings = sqliteTable('store_settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
