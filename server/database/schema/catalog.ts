import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  parentId: text('parent_id').references((): any => categories.id, { onDelete: 'set null' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('categories_slug_unique').on(table.slug),
  index('categories_parent_id_idx').on(table.parentId),
]))

// Reusable size charts, assignable at category level and overridable per product.
export const sizeGuides = sqliteTable('size_guides', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  // Structured measurement content, e.g. { columns: [...], rows: [...] }
  content: text('content', { mode: 'json' }).notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('size_guides_category_id_idx').on(table.categoryId),
]))

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  shortDescription: text('short_description'),
  sku: text('sku').notNull(),
  basePrice: integer('base_price').notNull(), // minor currency unit (cents)
  compareAtPrice: integer('compare_at_price'),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('draft'),
  isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  sizeGuideId: text('size_guide_id').references(() => sizeGuides.id, { onDelete: 'set null' }),
  // 'landing' swaps the storefront product page for a long-form, single-product
  // template with an embedded direct-order form in place of cart/checkout
  // (see AI_BUILD_PROGRESS.md "Landing product pages").
  layoutStyle: text('layout_style', { enum: ['standard', 'landing'] }).notNull().default('landing'),
  // Short "why you'll love it" bullets, e.g. [{ icon: '✨', text: '...' }]. Landing layout only.
  landingBenefits: text('landing_benefits', { mode: 'json' }).$type<Array<{ icon?: string, text: string }>>(),
  // Editorial lifestyle photo + caption blocks, e.g. [{ imageUrl, caption }]. Landing layout only.
  landingBlocks: text('landing_blocks', { mode: 'json' }).$type<Array<{ imageUrl: string, caption?: string }>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, table => ([
  uniqueIndex('products_slug_unique').on(table.slug),
  uniqueIndex('products_sku_unique').on(table.sku),
  index('products_status_idx').on(table.status),
]))

export const productCategories = sqliteTable('product_categories', {
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, table => ([
  uniqueIndex('product_categories_unique').on(table.productId, table.categoryId),
  index('product_categories_category_id_idx').on(table.categoryId),
]))

export const productImages = sqliteTable('product_images', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(), // R2 object URL
  altText: text('alt_text'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('product_images_product_id_idx').on(table.productId),
]))

// Store-wide attribute definitions, e.g. "Size", "Color", "Material".
export const productAttributes = sqliteTable('product_attributes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  displayType: text('display_type', { enum: ['text', 'select', 'swatch'] }).notNull().default('select'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('product_attributes_slug_unique').on(table.slug),
]))

export const productAttributeValues = sqliteTable('product_attribute_values', {
  id: text('id').primaryKey(),
  attributeId: text('attribute_id').notNull().references(() => productAttributes.id, { onDelete: 'cascade' }),
  value: text('value').notNull(), // e.g. "Black", "M"
  swatchHex: text('swatch_hex'),
  swatchImageUrl: text('swatch_image_url'),
  sortOrder: integer('sort_order').notNull().default(0),
}, table => ([
  index('product_attribute_values_attribute_id_idx').on(table.attributeId),
]))

export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull(),
  price: integer('price'), // overrides product.basePrice when set
  stock: integer('stock').notNull().default(0),
  imageUrl: text('image_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('product_variants_sku_unique').on(table.sku),
  index('product_variants_product_id_idx').on(table.productId),
]))

// A variant's specific combination of attribute values, e.g. Size: M + Color: Black.
export const variantAttributeValues = sqliteTable('variant_attribute_values', {
  variantId: text('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  attributeValueId: text('attribute_value_id').notNull().references(() => productAttributeValues.id, { onDelete: 'cascade' }),
}, table => ([
  uniqueIndex('variant_attribute_values_unique').on(table.variantId, table.attributeValueId),
  index('variant_attribute_values_value_idx').on(table.attributeValueId),
]))

// Per-locale overrides of customer-facing product copy. French is never stored
// here — `products`' own columns ARE the French content (source of truth) —
// this table only ever holds 'en'/'ar' rows. Any field left null falls back
// to the product's French value (see server/utils/locale.ts), so a partial
// translation never shows blank text.
export const productTranslations = sqliteTable('product_translations', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  locale: text('locale', { enum: ['en', 'ar'] }).notNull(),
  name: text('name'),
  shortDescription: text('short_description'),
  description: text('description'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  // Mirrors products.landingBenefits' shape, translated wholesale.
  landingBenefits: text('landing_benefits', { mode: 'json' }).$type<Array<{ icon?: string, text: string }>>(),
  // Captions only (images aren't translated), aligned by array index to the
  // product's own `landingBlocks`.
  landingBlockCaptions: text('landing_block_captions', { mode: 'json' }).$type<Array<string | null>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('product_translations_unique').on(table.productId, table.locale),
  index('product_translations_product_id_idx').on(table.productId),
]))

// Same pattern as product_translations: French lives on `categories` itself.
export const categoryTranslations = sqliteTable('category_translations', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  locale: text('locale', { enum: ['en', 'ar'] }).notNull(),
  name: text('name'),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('category_translations_unique').on(table.categoryId, table.locale),
  index('category_translations_category_id_idx').on(table.categoryId),
]))
