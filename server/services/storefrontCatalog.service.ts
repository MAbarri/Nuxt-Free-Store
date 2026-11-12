import { and, asc, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import {
  products, productImages, productVariants, variantAttributeValues,
  productAttributeValues, productAttributes, productCategories, categories,
  orderItems, sizeGuides,
} from '../database/schema'
import { useDb } from '../utils/db'

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'popularity'

export interface StorefrontListFilters {
  categorySlug?: string
  search?: string
  attributeValueIds?: string[]
  sort?: SortOption
  featured?: boolean
  page?: number
  pageSize?: number
}

interface VariantRow {
  productId: string
  variantId: string
  sku: string
  price: number | null
  stock: number
  isActive: boolean
  variantImageUrl: string | null
  valueId: string | null
  value: string | null
  swatchHex: string | null
  attributeId: string | null
  attributeName: string | null
  displayType: string | null
}

function buildCardDto(
  product: typeof products.$inferSelect,
  images: Array<typeof productImages.$inferSelect>,
  variantRows: VariantRow[],
  popularity: Map<string, number>,
) {
  const myImages = images.filter(i => i.productId === product.id)
  const myVariants = variantRows.filter(v => v.productId === product.id)

  const activePrices = myVariants.filter(v => v.isActive).map(v => v.price ?? product.basePrice)
  const prices = activePrices.length ? activePrices : [product.basePrice]

  const inStock = myVariants.length
    ? myVariants.some(v => v.isActive && v.stock > 0)
    : true

  const swatches = dedupeSwatches(myVariants.filter(v => v.displayType === 'swatch' && v.valueId))

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    isFeatured: product.isFeatured,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    primaryImageUrl: myImages[0]?.url ?? null,
    inStock,
    swatches,
    popularity: popularity.get(product.id) ?? 0,
    createdAt: product.createdAt,
  }
}

function dedupeSwatches(rows: VariantRow[]) {
  const seen = new Map<string, { valueId: string, value: string, swatchHex: string | null }>()
  for (const row of rows) {
    if (row.valueId && !seen.has(row.valueId)) {
      seen.set(row.valueId, { valueId: row.valueId, value: row.value!, swatchHex: row.swatchHex })
    }
  }
  return [...seen.values()]
}

export const storefrontCatalogService = {
  async list(event: H3Event, filters: StorefrontListFilters = {}) {
    const db = useDb(event)
    const page = Math.max(filters.page ?? 1, 1)
    const pageSize = Math.min(Math.max(filters.pageSize ?? 24, 1), 60)

    const conditions = [eq(products.status, 'active'), isNull(products.deletedAt)]
    if (filters.search) conditions.push(like(products.name, `%${filters.search}%`))
    if (filters.featured) conditions.push(eq(products.isFeatured, true))

    if (filters.categorySlug) {
      const [category] = await db.select({ id: categories.id }).from(categories)
        .where(eq(categories.slug, filters.categorySlug)).limit(1)
      if (!category) return { rows: [], total: 0, page, pageSize }
      const sub = db.select({ id: productCategories.productId }).from(productCategories)
        .where(eq(productCategories.categoryId, category.id))
      conditions.push(inArray(products.id, sub))
    }

    if (filters.attributeValueIds?.length) {
      const sub = db.select({ id: productVariants.productId })
        .from(productVariants)
        .innerJoin(variantAttributeValues, eq(variantAttributeValues.variantId, productVariants.id))
        .where(inArray(variantAttributeValues.attributeValueId, filters.attributeValueIds))
      conditions.push(inArray(products.id, sub))
    }

    const where = and(...conditions)

    const popularitySql = sql<number>`(SELECT COALESCE(SUM(${orderItems.quantity}), 0) FROM ${orderItems} WHERE ${orderItems.productId} = ${products.id})`

    const orderBy = filters.sort === 'price_asc'
      ? [asc(products.basePrice)]
      : filters.sort === 'price_desc'
        ? [desc(products.basePrice)]
        : filters.sort === 'popularity'
          ? [desc(popularitySql)]
          : [desc(products.createdAt)]

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(products).where(where).orderBy(...orderBy).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` }).from(products).where(where),
    ])

    const productIds = rows.map(p => p.id)
    if (!productIds.length) return { rows: [], total: Number(count), page, pageSize }

    const [images, variantRows, popularityRows] = await Promise.all([
      db.select().from(productImages).where(inArray(productImages.productId, productIds)).orderBy(asc(productImages.sortOrder)),
      this.loadVariantRows(event, productIds),
      db.select({ productId: orderItems.productId, qty: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)` })
        .from(orderItems).where(inArray(orderItems.productId, productIds)).groupBy(orderItems.productId),
    ])

    const popularity = new Map(popularityRows.filter(r => r.productId).map(r => [r.productId as string, Number(r.qty)]))

    return {
      rows: rows.map(p => buildCardDto(p, images, variantRows, popularity)),
      total: Number(count),
      page,
      pageSize,
    }
  },

  async loadVariantRows(event: H3Event, productIds: string[]): Promise<VariantRow[]> {
    const db = useDb(event)
    if (!productIds.length) return []
    return db.select({
      productId: productVariants.productId,
      variantId: productVariants.id,
      sku: productVariants.sku,
      price: productVariants.price,
      stock: productVariants.stock,
      isActive: productVariants.isActive,
      variantImageUrl: productVariants.imageUrl,
      valueId: productAttributeValues.id,
      value: productAttributeValues.value,
      swatchHex: productAttributeValues.swatchHex,
      attributeId: productAttributes.id,
      attributeName: productAttributes.name,
      displayType: productAttributes.displayType,
    })
      .from(productVariants)
      .leftJoin(variantAttributeValues, eq(variantAttributeValues.variantId, productVariants.id))
      .leftJoin(productAttributeValues, eq(productAttributeValues.id, variantAttributeValues.attributeValueId))
      .leftJoin(productAttributes, eq(productAttributes.id, productAttributeValues.attributeId))
      .where(inArray(productVariants.productId, productIds))
  },

  async getBySlug(event: H3Event, slug: string) {
    const db = useDb(event)
    const [product] = await db.select().from(products)
      .where(and(eq(products.slug, slug), eq(products.status, 'active'), isNull(products.deletedAt)))
      .limit(1)
    if (!product) return null

    const [images, variantRows, categoryRows] = await Promise.all([
      db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder)),
      this.loadVariantRows(event, [product.id]),
      db.select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(productCategories)
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .where(eq(productCategories.productId, product.id)),
    ])

    const variantIds = [...new Set(variantRows.map(v => v.variantId))]
    const variants = variantIds.map((id) => {
      const rowsForVariant = variantRows.filter(v => v.variantId === id)
      const first = rowsForVariant[0]
      return {
        id,
        sku: first.sku,
        price: first.price,
        stock: first.stock,
        isActive: first.isActive,
        imageUrl: first.variantImageUrl,
        attributes: rowsForVariant.filter(r => r.valueId).map(r => ({
          attributeId: r.attributeId,
          attributeName: r.attributeName,
          displayType: r.displayType,
          valueId: r.valueId,
          value: r.value,
          swatchHex: r.swatchHex,
        })),
      }
    })

    let sizeGuide = null
    const sizeGuideId = product.sizeGuideId ?? null
    if (sizeGuideId) {
      const [guide] = await db.select().from(sizeGuides).where(eq(sizeGuides.id, sizeGuideId)).limit(1)
      sizeGuide = guide ?? null
    }
    else if (categoryRows[0]) {
      const [guide] = await db.select().from(sizeGuides).where(eq(sizeGuides.categoryId, categoryRows[0].id)).limit(1)
      sizeGuide = guide ?? null
    }

    let related: Awaited<ReturnType<typeof this.list>>['rows'] = []
    if (categoryRows[0]) {
      const result = await this.list(event, { categorySlug: categoryRows[0].slug, pageSize: 5 })
      related = result.rows.filter(r => r.id !== product.id).slice(0, 4)
    }

    return { ...product, images, variants, categories: categoryRows, sizeGuide, related }
  },
}
