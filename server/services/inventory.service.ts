import { and, asc, desc, eq, lte, sql } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { productVariants, inventoryAdjustments, products } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

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
