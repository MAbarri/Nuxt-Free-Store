import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../../server/database/schema'
import { inventoryService } from '../../server/services/inventory.service'
import { generateId } from '../../server/utils/id'

function fakeEvent() {
  return { context: { cloudflare: { env } } } as any
}

describe('inventoryService.adjustStock', () => {
  let variantId: string

  beforeEach(async () => {
    const db = drizzle(env.DB, { schema })
    const now = new Date()
    const productId = generateId('prod')

    await db.insert(schema.products).values({
      id: productId,
      name: 'Test Tee',
      slug: `test-tee-${productId}`,
      sku: `SKU-${productId}`,
      basePrice: 1000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    variantId = generateId('vrt')
    await db.insert(schema.productVariants).values({
      id: variantId,
      productId,
      sku: `SKU-${variantId}`,
      stock: 5,
      createdAt: now,
      updatedAt: now,
    })
  })

  it('decrements stock when enough is available', async () => {
    const stock = await inventoryService.adjustStock(fakeEvent(), variantId, -3, 'order_placed')
    expect(stock).toBe(2)
  })

  it('rejects a decrement that would oversell', async () => {
    await expect(
      inventoryService.adjustStock(fakeEvent(), variantId, -10, 'order_placed'),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('never oversells under concurrent decrements', async () => {
    // 5 in stock, 8 concurrent attempts to buy 1 each — exactly 5 should succeed.
    const attempts = Array.from({ length: 8 }, () =>
      inventoryService.adjustStock(fakeEvent(), variantId, -1, 'order_placed')
        .then(() => 'ok' as const)
        .catch(() => 'rejected' as const),
    )
    const results = await Promise.all(attempts)

    expect(results.filter(r => r === 'ok')).toHaveLength(5)
    expect(results.filter(r => r === 'rejected')).toHaveLength(3)

    const db = drizzle(env.DB, { schema })
    const [row] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(row?.stock).toBe(0)
  })

  it('increments stock for restocks', async () => {
    const stock = await inventoryService.adjustStock(fakeEvent(), variantId, 10, 'restock')
    expect(stock).toBe(15)
  })

  it('records an inventory adjustment entry for every change', async () => {
    await inventoryService.adjustStock(fakeEvent(), variantId, -2, 'order_placed', { note: 'test order' })
    const history = await inventoryService.history(fakeEvent(), variantId)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ changeQty: -2, resultingStock: 3, reason: 'order_placed', note: 'test order' })
  })
})
