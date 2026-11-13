import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../../server/database/schema'
import { checkoutService } from '../../server/services/checkout.service'
import { generateId } from '../../server/utils/id'

function fakeEvent() {
  return { context: { cloudflare: { env }, guestToken: generateId('guest'), auth: null } } as any
}

async function seedProduct(opts: { layoutStyle?: 'standard' | 'landing', stock?: number, basePrice?: number } = {}) {
  const db = drizzle(env.DB, { schema })
  const now = new Date()
  const productId = generateId('prod')
  await db.insert(schema.products).values({
    id: productId,
    name: 'Landing Test Jacket',
    slug: `landing-test-jacket-${productId}`,
    sku: `SKU-${productId}`,
    basePrice: opts.basePrice ?? 8000,
    status: 'active',
    layoutStyle: opts.layoutStyle ?? 'landing',
    createdAt: now,
    updatedAt: now,
  })
  const variantId = generateId('vrt')
  await db.insert(schema.productVariants).values({
    id: variantId,
    productId,
    sku: `SKU-${variantId}`,
    stock: opts.stock ?? 10,
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

describe('checkoutService.createDirectOrder', () => {
  it('creates an order directly for a single product/variant and decrements stock', async () => {
    const { productId, variantId } = await seedProduct({ stock: 10, basePrice: 8000 })
    const event = fakeEvent()

    const order = await checkoutService.createDirectOrder(event, { ...validCustomer, productId, variantId, quantity: 2 })

    expect(order.status).toBe('pending_confirmation')
    expect(order.paymentMethod).toBe('cod')
    expect(order.subtotal).toBe(16000)
    expect(order.total).toBe(order.subtotal + order.shippingFee)
    expect(order.items).toHaveLength(1)
    expect(order.items[0]).toMatchObject({ productId, variantId, quantity: 2, unitPrice: 8000, subtotal: 16000 })

    const db = drizzle(env.DB, { schema })
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(variant?.stock).toBe(8)
  })

  it('rejects when the product is not a Landing-style product', async () => {
    const { productId, variantId } = await seedProduct({ layoutStyle: 'standard' })
    const event = fakeEvent()

    await expect(
      checkoutService.createDirectOrder(event, { ...validCustomer, productId, variantId, quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rejects when the requested quantity exceeds stock, leaving stock untouched', async () => {
    const { productId, variantId } = await seedProduct({ stock: 1 })
    const event = fakeEvent()

    await expect(
      checkoutService.createDirectOrder(event, { ...validCustomer, productId, variantId, quantity: 5 }),
    ).rejects.toMatchObject({ statusCode: 409 })

    const db = drizzle(env.DB, { schema })
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(variant?.stock).toBe(1)
  })

  it('rejects when the product does not exist', async () => {
    const event = fakeEvent()
    await expect(
      checkoutService.createDirectOrder(event, { ...validCustomer, productId: 'prod_missing', variantId: 'vrt_missing', quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
