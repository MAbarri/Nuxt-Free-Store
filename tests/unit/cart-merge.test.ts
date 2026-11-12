import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../../server/database/schema'
import { cartService } from '../../server/services/cart.service'
import { cartRepository } from '../../server/repositories/cart.repository'
import { generateId } from '../../server/utils/id'

function fakeEvent(guestToken?: string) {
  // `auth: null` short-circuits getAuthUser's cookie lookup (there's no real
  // HTTP request here to parse cookies from) so these service calls behave
  // exactly like an unauthenticated request.
  return { context: { cloudflare: { env }, guestToken, auth: null } } as any
}

async function seedProductWithVariant(stock: number) {
  const db = drizzle(env.DB, { schema })
  const now = new Date()
  const productId = generateId('prod')
  await db.insert(schema.products).values({
    id: productId,
    name: 'Merge Test Shirt',
    slug: `merge-test-shirt-${productId}`,
    sku: `SKU-${productId}`,
    basePrice: 5000,
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

async function seedCustomer() {
  const db = drizzle(env.DB, { schema })
  const now = new Date()
  const userId = generateId('usr')
  await db.insert(schema.users).values({
    id: userId, email: `${userId}@example.com`, passwordHash: 'x', role: 'customer', createdAt: now, updatedAt: now,
  })
  const profileId = generateId('cprof')
  await db.insert(schema.customerProfiles).values({ id: profileId, userId, createdAt: now, updatedAt: now })
  return profileId
}

describe('cart guest -> account merge', () => {
  let productId: string
  let variantId: string

  beforeEach(async () => {
    ({ productId, variantId } = await seedProductWithVariant(10))
  })

  it('moves guest cart items into a fresh account cart', async () => {
    const guestToken = generateId('guest')
    const guestEvent = fakeEvent(guestToken)
    await cartService.addItem(guestEvent, { productId, variantId, quantity: 2 })

    const customerProfileId = await seedCustomer()
    await cartService.mergeGuestCartIntoCustomer(fakeEvent(guestToken), customerProfileId)

    const accountCart = await cartRepository.findActiveByCustomerProfileId(fakeEvent(), customerProfileId)
    expect(accountCart).toBeTruthy()
    const items = await cartRepository.listItems(fakeEvent(), accountCart!.id)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ productId, variantId, quantity: 2 })
  })

  it('combines quantities when the account already has the same item', async () => {
    const customerProfileId = await seedCustomer()
    const accountCartId = await cartRepository.create(fakeEvent(), { customerProfileId })
    await cartRepository.upsertItem(fakeEvent(), accountCartId, productId, variantId, 2)

    const guestToken = generateId('guest')
    await cartService.addItem(fakeEvent(guestToken), { productId, variantId, quantity: 3 })

    await cartService.mergeGuestCartIntoCustomer(fakeEvent(guestToken), customerProfileId)

    const items = await cartRepository.listItems(fakeEvent(), accountCartId)
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(5)
  })

  it('deletes the guest cart after merging, so the same guest token can start a new cart later', async () => {
    const guestToken = generateId('guest')
    await cartService.addItem(fakeEvent(guestToken), { productId, variantId, quantity: 1 })

    const guestCartBefore = await cartRepository.findActiveByGuestToken(fakeEvent(), guestToken)
    expect(guestCartBefore).toBeTruthy()

    const customerProfileId = await seedCustomer()
    await cartService.mergeGuestCartIntoCustomer(fakeEvent(guestToken), customerProfileId)

    // The old guest cart row must be gone (not just marked inactive), otherwise the
    // unique index on carts.guestToken would block reusing this guest token.
    const db = drizzle(env.DB, { schema })
    const rows = await db.select().from(schema.carts).where(eq(schema.carts.guestToken, guestToken))
    expect(rows).toHaveLength(0)

    // Reusing the same guest token for a brand-new cart must not throw.
    await expect(cartService.addItem(fakeEvent(guestToken), { productId, variantId, quantity: 1 })).resolves.toBeDefined()
  })
})
