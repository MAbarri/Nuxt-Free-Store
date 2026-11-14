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
  imageInstructions: text('image_instructions'),
  caption: text('caption').notNull(),
  hashtags: text('hashtags', { mode: 'json' }).notNull().$type<string[]>(),
  // The exact on-image text the generated photo was asked to render (see
  // marketing.service.ts's buildSocialImagePrompt) — kept for transparency/
  // regeneration context. Nullable since posts saved before this field
  // existed have none.
  headline: text('headline'),
  overlayText: text('overlay_text'),
  cost: real('cost').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('social_posts_created_at_idx').on(table.createdAt),
]))

// Saved history of AI-generated ad creatives (Marketing → Ads content
// generator). Same denormalized-at-save-time shape as socialPosts, plus the
// Meta/TikTok-style ad copy fields (headline, primary text, description,
// call-to-action) instead of a caption/hashtags pair.
export const adCreatives = sqliteTable('ad_creatives', {
  id: text('id').primaryKey(),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  imageUrl: text('image_url'),
  platform: text('platform').notNull(),
  locale: text('locale').notNull(),
  designTypeId: text('design_type_id').notNull(),
  designTypeLabel: text('design_type_label').notNull(),
  extraNotes: text('extra_notes'),
  imageInstructions: text('image_instructions'),
  headline: text('headline').notNull(),
  primaryText: text('primary_text').notNull(),
  description: text('description'),
  ctaLabel: text('cta_label').notNull(),
  badgeText: text('badge_text'),
  cost: real('cost').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('ad_creatives_created_at_idx').on(table.createdAt),
]))
