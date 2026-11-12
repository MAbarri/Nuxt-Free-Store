import { and, asc, desc, eq, inArray, like, lte, or, sql } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import {
  productVariants,
  inventoryAdjustments,
  products,
  variantAttributeValues,
  productAttributeValues,
  productAttributes,
} from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface VariantListFilters {
  search?: string
  page?: number
  pageSize?: number
}

export type AdjustmentReason = 'order_placed' | 'order_cancelled' | 'manual_adjustment' | 'restock'

export const inventoryService = {
  /**
   * Atomically changes a variant's stock by `delta` (negative to decrement).
   * Decrements are guarded by a conditional WHERE clause so concurrent
   * checkouts can never oversell: the row is only updated if enough stock
   * remains, and the caller gets a 409 Conflict otherwise. This is the
   * single choke point used by checkout, admin manual adjustments, and
   * order cancellation/restoration.
   */
  async adjustStock(
    event: H3Event,
    variantId: string,
    delta: number,
    reason: AdjustmentReason,
    opts: { note?: string, orderId?: string, createdByUserId?: string } = {},
  ): Promise<number> {
    if (!Number.isInteger(delta) || delta === 0) {
      throw createError({ statusCode: 422, statusMessage: 'Stock adjustment delta must be a non-zero integer' })
    }

    const db = useDb(event)
    const now = new Date()

    const where = delta < 0
      ? sql`${productVariants.id} = ${variantId} AND ${productVariants.stock} + ${delta} >= 0`
      : eq(productVariants.id, variantId)

    const rows = await db.update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${delta}`, updatedAt: now })
      .where(where)
      .returning({ stock: productVariants.stock })

    const updated = rows[0]
    if (!updated) {
      throw createError({ statusCode: 409, statusMessage: 'Insufficient stock for this variant' })
    }

    await db.insert(inventoryAdjustments).values({
      id: generateId('inv'),
      variantId,
      changeQty: delta,
      resultingStock: updated.stock,
      reason,
      note: opts.note ?? null,
      orderId: opts.orderId ?? null,
      createdByUserId: opts.createdByUserId ?? null,
      createdAt: now,
    })

    return updated.stock
  },

  async history(event: H3Event, variantId: string) {
    const db = useDb(event)
    return db.select().from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.variantId, variantId))
      .orderBy(desc(inventoryAdjustments.createdAt))
  },

  /** Every variant across the catalog, searchable by product name or SKU — used by the admin inventory page. */
  async listVariants(event: H3Event, filters: VariantListFilters = {}) {
    const db = useDb(event)
    const page = Math.max(filters.page ?? 1, 1)
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100)

    const conditions = []
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(or(like(products.name, term), like(productVariants.sku, term))!)
    }
    const where = conditions.length ? and(...conditions) : undefined

    const [rows, [{ count }]] = await Promise.all([
      db.select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        price: productVariants.price,
        stock: productVariants.stock,
        imageUrl: productVariants.imageUrl,
        isActive: productVariants.isActive,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        productStatus: products.status,
        basePrice: products.basePrice,
      })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(where)
        .orderBy(asc(products.name), asc(productVariants.sku))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(where),
    ])

    if (!rows.length) return { rows: [], total: Number(count), page, pageSize }

    const variantIds = rows.map(r => r.variantId)
    const valueRows = await db.select({
      variantId: variantAttributeValues.variantId,
      attributeName: productAttributes.name,
      value: productAttributeValues.value,
    })
      .from(variantAttributeValues)
      .innerJoin(productAttributeValues, eq(productAttributeValues.id, variantAttributeValues.attributeValueId))
      .innerJoin(productAttributes, eq(productAttributes.id, productAttributeValues.attributeId))
      .where(inArray(variantAttributeValues.variantId, variantIds))

    return {
      rows: rows.map(r => ({
        ...r,
        attributes: valueRows.filter(v => v.variantId === r.variantId).map(v => ({ attributeName: v.attributeName, value: v.value })),
      })),
      total: Number(count),
      page,
      pageSize,
    }
  },

  async lowStock(event: H3Event, threshold = 5) {
    const db = useDb(event)
    return db.select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      stock: productVariants.stock,
      productId: products.id,
      productName: products.name,
      productStatus: products.status,
    })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(productVariants.isActive, true), eq(products.status, 'active'), lte(productVariants.stock, threshold)))
      .orderBy(asc(productVariants.stock))
  },
}
