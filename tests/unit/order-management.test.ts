import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../../server/database/schema'
import { cartService } from '../../server/services/cart.service'
import { checkoutService } from '../../server/services/checkout.service'
import { ordersService } from '../../server/services/orders.service'
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
    name: 'Order Mgmt Test Shirt',
    slug: `order-mgmt-test-shirt-${productId}`,
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

async function placeOrder(variantId: string, productId: string, quantity: number) {
  const event = fakeEvent(generateId('guest'))
  await cartService.addItem(event, { productId, variantId, quantity })
  return checkoutService.createOrder(event, {
    fullName: 'Order Mgmt Customer',
    phone: '555-0199',
    city: 'Anytown',
    addressLine: '1 Example Street',
  })
}

describe('ordersService status transitions', () => {
  let productId: string
  let variantId: string

  beforeEach(async () => {
    ({ productId, variantId } = await seedProductWithVariant(10, 5000))
  })

  it('restores stock when an order is cancelled', async () => {
    const order = await placeOrder(variantId, productId, 3)
    const db = drizzle(env.DB, { schema })

    const [afterOrder] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(afterOrder?.stock).toBe(7)

    const updated = await ordersService.updateStatus(fakeEvent(), order.id, 'cancelled', { note: 'customer requested cancellation' })
    expect(updated.status).toBe('cancelled')

    const [afterCancel] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(afterCancel?.stock).toBe(10)

    expect(updated.history.some(h => h.toStatus === 'cancelled')).toBe(true)
  })

  it('does not double-restore stock when cancelling an already-cancelled order', async () => {
    const order = await placeOrder(variantId, productId, 2)
    await ordersService.updateStatus(fakeEvent(), order.id, 'cancelled')

    // Re-applying the same status is a no-op (short-circuited), stock stays restored once.
    await ordersService.updateStatus(fakeEvent(), order.id, 'cancelled')

    const db = drizzle(env.DB, { schema })
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(variant?.stock).toBe(10)
  })

  it('restores stock when an order is marked returned', async () => {
    const order = await placeOrder(variantId, productId, 4)
    await ordersService.updateStatus(fakeEvent(), order.id, 'delivered')

    const updated = await ordersService.updateStatus(fakeEvent(), order.id, 'returned', { note: 'customer returned items' })
    expect(updated.status).toBe('returned')

    const db = drizzle(env.DB, { schema })
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(variant?.stock).toBe(10)
  })

  it('does not restore stock for ordinary status progression', async () => {
    const order = await placeOrder(variantId, productId, 2)
    await ordersService.updateStatus(fakeEvent(), order.id, 'confirmed')
    await ordersService.updateStatus(fakeEvent(), order.id, 'shipped')

    const db = drizzle(env.DB, { schema })
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(variant?.stock).toBe(8)
  })

  it('updates payment status independently of order status', async () => {
    const order = await placeOrder(variantId, productId, 1)
    expect(order.paymentStatus).toBe('unpaid')

    const updated = await ordersService.updatePaymentStatus(fakeEvent(), order.id, 'paid')
    expect(updated.paymentStatus).toBe('paid')
    expect(updated.status).toBe('pending_confirmation')
  })
})
