import { and, asc, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { products, productCategories, productImages } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface ProductInput {
  name: string
  slug: string
  description?: string | null
  shortDescription?: string | null
  sku: string
  basePrice: number
  compareAtPrice?: number | null
  status?: 'draft' | 'active' | 'archived'
  isFeatured?: boolean
  seoTitle?: string | null
  seoDescription?: string | null
  sizeGuideId?: string | null
  layoutStyle?: 'standard' | 'landing'
  landingBenefits?: Array<{ icon?: string, text: string }> | null
  landingBlocks?: Array<{ imageUrl: string, caption?: string }> | null
}

export interface ProductListFilters {
  status?: 'draft' | 'active' | 'archived'
  search?: string
  categoryId?: string
  page?: number
  pageSize?: number
}

export const productsRepository = {
  async list(event: H3Event, filters: ProductListFilters = {}) {
    const db = useDb(event)
    const page = Math.max(filters.page ?? 1, 1)
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100)

    const conditions = [isNull(products.deletedAt)]
    if (filters.status) conditions.push(eq(products.status, filters.status))
    if (filters.search) conditions.push(like(products.name, `%${filters.search}%`))
    if (filters.categoryId) {
      const sub = db.select({ id: productCategories.productId })
        .from(productCategories)
        .where(eq(productCategories.categoryId, filters.categoryId))
      conditions.push(inArray(products.id, sub))
    }
    const where = and(...conditions)

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(products).where(where)
        .orderBy(desc(products.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` }).from(products).where(where),
    ])

    return { rows, total: Number(count), page, pageSize }
  },

  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1)
    return row ?? null
  },

  async findBySlug(event: H3Event, slug: string) {
    const db = useDb(event)
    const [row] = await db.select().from(products).where(and(eq(products.slug, slug), isNull(products.deletedAt))).limit(1)
    return row ?? null
  },

  async findBySku(event: H3Event, sku: string) {
    const db = useDb(event)
    const [row] = await db.select().from(products).where(eq(products.sku, sku)).limit(1)
    return row ?? null
  },

  async create(event: H3Event, input: ProductInput) {
    const db = useDb(event)
    const id = generateId('prod')
    const now = new Date()
    await db.insert(products).values({
      id,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      shortDescription: input.shortDescription ?? null,
      sku: input.sku,
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice ?? null,
      status: input.status ?? 'draft',
      isFeatured: input.isFeatured ?? false,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      sizeGuideId: input.sizeGuideId ?? null,
      layoutStyle: input.layoutStyle ?? 'landing',
      landingBenefits: input.landingBenefits ?? null,
      landingBlocks: input.landingBlocks ?? null,
      createdAt: now,
      updatedAt: now,
    })
    return this.findById(event, id)
  },

  async update(event: H3Event, id: string, input: Partial<ProductInput>) {
    const db = useDb(event)
    await db.update(products).set({ ...input, updatedAt: new Date() }).where(eq(products.id, id))
    return this.findById(event, id)
  },

  /** Hard delete. Order history survives via order_items' denormalized snapshot + `onDelete: set null`. */
  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(products).where(eq(products.id, id))
  },

  async setCategories(event: H3Event, productId: string, categoryIds: string[]) {
    const db = useDb(event)
    await db.delete(productCategories).where(eq(productCategories.productId, productId))
    if (categoryIds.length) {
      await db.insert(productCategories).values(categoryIds.map(categoryId => ({ productId, categoryId })))
    }
  },

  async getCategoryIds(event: H3Event, productId: string) {
    const db = useDb(event)
    const rows = await db.select({ categoryId: productCategories.categoryId })
      .from(productCategories).where(eq(productCategories.productId, productId))
    return rows.map(r => r.categoryId)
  },

  async listImages(event: H3Event, productId: string) {
    const db = useDb(event)
    return db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder))
  },

  async addImage(event: H3Event, productId: string, input: { url: string, altText?: string | null, sortOrder?: number }) {
    const db = useDb(event)
    const id = generateId('img')
    await db.insert(productImages).values({
      id,
      productId,
      url: input.url,
      altText: input.altText ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: new Date(),
    })
    return id
  },

  async removeImage(event: H3Event, imageId: string) {
    const db = useDb(event)
    const [row] = await db.select().from(productImages).where(eq(productImages.id, imageId)).limit(1)
    await db.delete(productImages).where(eq(productImages.id, imageId))
    return row ?? null
  },
}
