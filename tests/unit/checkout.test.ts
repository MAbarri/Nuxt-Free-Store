import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../../server/database/schema'
import { cartService } from '../../server/services/cart.service'
import { checkoutService } from '../../server/services/checkout.service'
import { inventoryService } from '../../server/services/inventory.service'
import { generateId } from '../../server/utils/id'

function fakeEvent(guestToken?: string) {
  return { context: { cloudflare: { env }, guestToken, auth: null } } as any
}

async function seedProductWithVariant(stock: number, basePrice = 5000) {
  const db = drizzle(env.DB, { schema })
  const now = new Date()
  const productId = generateId('prod')
  await db.insert(schema.products).values({
    id: productId,
    name: 'Checkout Test Shirt',
    slug: `checkout-test-shirt-${productId}`,
    sku: `SKU-${productId}`,
    basePrice,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const variantId = generateId('vrt')
  await db.insert(schema.productVariants).values({
    id: variantId,
    productId,
    sku: `SKU-${variantId}`,
    stock,
    createdAt: now,
    updatedAt: now,
  })
  return { productId, variantId }
}

const validCustomer = {
  fullName: 'Test Customer',
  phone: '555-0100',
  city: 'Anytown',
  addressLine: '1 Example Street',
}

describe('checkoutService.createOrder', () => {
  let productId: string
  let variantId: string

  beforeEach(async () => {
    ({ productId, variantId } = await seedProductWithVariant(10, 5000))
  })

  it('creates an order, decrements stock, and clears the cart', async () => {
    const guestToken = generateId('guest')
    const event = fakeEvent(guestToken)
    await cartService.addItem(event, { productId, variantId, quantity: 2 })

    const order = await checkoutService.createOrder(event, validCustomer)

    expect(order.status).toBe('pending_confirmation')
    expect(order.paymentStatus).toBe('unpaid')
    expect(order.paymentMethod).toBe('cod')
    expect(order.subtotal).toBe(10000)
    expect(order.total).toBe(order.subtotal + order.shippingFee)
    expect(order.items).toHaveLength(1)
    expect(order.items[0]).toMatchObject({ productId, variantId, quantity: 2, unitPrice: 5000, subtotal: 10000 })
    expect(order.history).toHaveLength(1)

    const db = drizzle(env.DB, { schema })
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(variant?.stock).toBe(8)

    const cartAfter = await cartService.get(event)
    expect(cartAfter.items).toHaveLength(0)
  })

  it('rejects checkout with an empty cart', async () => {
    const event = fakeEvent(generateId('guest'))
    await expect(checkoutService.createOrder(event, validCustomer)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rejects and leaves stock untouched when an item sells out between cart and checkout', async () => {
    const guestToken = generateId('guest')
    const event = fakeEvent(guestToken)
    await cartService.addItem(event, { productId, variantId, quantity: 2 })

    // Simulate a concurrent sale that depletes stock after the item was added to the cart.
    await inventoryService.adjustStock(event, variantId, -10, 'manual_adjustment', { note: 'simulate concurrent sale' })

    await expect(checkoutService.createOrder(event, validCustomer)).rejects.toMatchObject({ statusCode: 409 })

    const db = drizzle(env.DB, { schema })
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(variant?.stock).toBe(0) // unchanged by the failed checkout attempt

    const orderItemsForProduct = await db.select().from(schema.orderItems).where(eq(schema.orderItems.productId, productId))
    expect(orderItemsForProduct).toHaveLength(0) // no order was created
  })

  it('rolls back earlier stock decrements when a later item in the same order fails', async () => {
    const { productId: productId2, variantId: variantId2 } = await seedProductWithVariant(1, 3000)

    const guestToken = generateId('guest')
    const event = fakeEvent(guestToken)
    await cartService.addItem(event, { productId, variantId, quantity: 2 })
    await cartService.addItem(event, { productId: productId2, variantId: variantId2, quantity: 1 })

    // Deplete the second item's stock after both are already in the cart.
    await inventoryService.adjustStock(event, variantId2, -1, 'manual_adjustment', { note: 'simulate concurrent sale' })

    await expect(checkoutService.createOrder(event, validCustomer)).rejects.toMatchObject({ statusCode: 409 })

    const db = drizzle(env.DB, { schema })
    const [firstVariant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    // Stock for the first item must be restored to its original value, not left decremented.
    expect(firstVariant?.stock).toBe(10)
  })
})
