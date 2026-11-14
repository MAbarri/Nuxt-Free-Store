import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { products } from './catalog'

// Saved history of AI-generated social media posts (Marketing → Social post
// generator). Product name/image are denormalized at save time since the
// product itself might be edited or deleted later and a saved post should
// still read sensibly on its own.
export const socialPosts = sqliteTable('social_posts', {
  id: text('id').primaryKey(),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  imageUrl: text('image_url'),
  platform: text('platform').notNull(),
  locale: text('locale').notNull(),
  promptTypeId: text('prompt_type_id').notNull(),
  promptTypeLabel: text('prompt_type_label').notNull(),
  extraNotes: text('extra_notes'),
  caption: text('caption').notNull(),
  hashtags: text('hashtags', { mode: 'json' }).notNull().$type<string[]>(),
  cost: real('cost').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('social_posts_created_at_idx').on(table.createdAt),
]))
