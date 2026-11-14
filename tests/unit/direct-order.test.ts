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

async function seedProduct(opts: { layoutStyle?: 'standard' | 'landing', stock?: number, basePrice?: number, quantityDiscountMinQty?: number, quantityDiscountPercent?: number } = {}) {
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
    quantityDiscountMinQty: opts.quantityDiscountMinQty ?? null,
    quantityDiscountPercent: opts.quantityDiscountPercent ?? null,
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

async function seedUpsell(productId: string, relatedProductId: string) {
  const db = drizzle(env.DB, { schema })
  await db.insert(schema.productUpsells).values({
    id: generateId('upsell'),
    productId,
    relatedProductId,
    position: 0,
    createdAt: new Date(),
  })
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

  it('applies a per-product quantity-break discount once the threshold is reached', async () => {
    const { productId, variantId } = await seedProduct({ stock: 10, basePrice: 10000, quantityDiscountMinQty: 2, quantityDiscountPercent: 10 })
    const event = fakeEvent()

    const below = await checkoutService.createDirectOrder(fakeEvent(), { ...validCustomer, productId, variantId, quantity: 1 })
    expect(below.subtotal).toBe(10000) // below threshold — no discount

    const atThreshold = await checkoutService.createDirectOrder(event, { ...validCustomer, productId, variantId, quantity: 2 })
    expect(atThreshold.subtotal).toBe(18000) // 20000 * 0.9
    expect(atThreshold.items[0]).toMatchObject({ unitPrice: 10000, quantity: 2, subtotal: 18000 })
  })

  it('adds a configured companion as a second fixed-quantity-1 line item', async () => {
    const { productId, variantId } = await seedProduct({ stock: 10, basePrice: 8000 })
    const { productId: companionProductId, variantId: companionVariantId } = await seedProduct({ stock: 5, basePrice: 3000, layoutStyle: 'standard' })
    await seedUpsell(productId, companionProductId)
    const event = fakeEvent()

    const order = await checkoutService.createDirectOrder(event, {
      ...validCustomer, productId, variantId, quantity: 1,
      companionProductId, companionVariantId,
    })

    expect(order.items).toHaveLength(2)
    expect(order.subtotal).toBe(8000 + 3000)
    expect(order.items.find(i => i.productId === companionProductId)).toMatchObject({ quantity: 1, unitPrice: 3000 })

    const db = drizzle(env.DB, { schema })
    const [companionVariant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, companionVariantId))
    expect(companionVariant?.stock).toBe(4)
  })

  it('rejects a companion that is not a configured upsell of the main product', async () => {
    const { productId, variantId } = await seedProduct({ stock: 10 })
    const { productId: otherProductId, variantId: otherVariantId } = await seedProduct({ stock: 5 })
    const event = fakeEvent()

    await expect(
      checkoutService.createDirectOrder(event, {
        ...validCustomer, productId, variantId, quantity: 1,
        companionProductId: otherProductId, companionVariantId: otherVariantId,
      }),
    ).rejects.toMatchObject({ statusCode: 422 })

    // Main item's stock must be untouched by the rejected companion.
    const db = drizzle(env.DB, { schema })
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    expect(variant?.stock).toBe(10)
  })
})
