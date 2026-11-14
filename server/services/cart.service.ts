import { eq } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { cartRepository } from '../repositories/cart.repository'
import { resolveCustomerProfileId } from '../utils/customer'
import { getGuestToken, getOrCreateGuestToken } from '../utils/guestToken'
import { useDb } from '../utils/db'
import { applyQuantityDiscount } from '../utils/pricing'
import { products, productVariants, variantAttributeValues, productAttributeValues, productAttributes } from '../database/schema'

async function findExistingCart(event: H3Event) {
  const customerProfileId = await resolveCustomerProfileId(event)
  if (customerProfileId) {
    const cart = await cartRepository.findActiveByCustomerProfileId(event, customerProfileId)
    if (cart) return cart
  }
  const guestToken = getGuestToken(event)
  if (guestToken) {
    const cart = await cartRepository.findActiveByGuestToken(event, guestToken)
    if (cart) return cart
  }
  return null
}

async function getOrCreateCart(event: H3Event) {
  const existing = await findExistingCart(event)
  if (existing) return existing

  const customerProfileId = await resolveCustomerProfileId(event)
  const id = customerProfileId
    ? await cartRepository.create(event, { customerProfileId })
    : await cartRepository.create(event, { guestToken: getOrCreateGuestToken(event) })

  const created = await cartRepository.findById(event, id)
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Failed to create cart' })
  return created
}

async function buildVariantLabel(event: H3Event, variantId: string | null): Promise<string | null> {
  if (!variantId) return null
  const db = useDb(event)
  const rows = await db.select({ name: productAttributes.name, value: productAttributeValues.value })
    .from(variantAttributeValues)
    .innerJoin(productAttributeValues, eq(productAttributeValues.id, variantAttributeValues.attributeValueId))
    .innerJoin(productAttributes, eq(productAttributes.id, productAttributeValues.attributeId))
    .where(eq(variantAttributeValues.variantId, variantId))
  if (!rows.length) return null
  return rows.map(r => `${r.name}: ${r.value}`).join(' / ')
}

/**
 * Builds the cart response entirely from current product/variant state —
 * prices, stock and availability are never trusted from what was stored
 * when the item was added. This is what makes the cart safe to display
 * without treating client-side data as authoritative (see spec §5).
 */
async function hydrate(event: H3Event, cartId: string) {
  const db = useDb(event)
  const items = await cartRepository.listItems(event, cartId)

  const hydratedItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1)
    const variant = item.variantId
      ? (await db.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1))[0]
      : undefined

    const productAvailable = !!product && product.status === 'active' && !product.deletedAt
    const variantAvailable = !item.variantId || (!!variant && variant.isActive)
    const stock = variant?.stock ?? 0
    const available = productAvailable && variantAvailable && stock > 0
    const unitPrice = variant?.price ?? product?.basePrice ?? 0
    const cappedQuantity = Math.min(item.quantity, Math.max(stock, 0))
    const effectiveQuantity = available ? cappedQuantity : 0
    const { subtotal, discountApplied } = applyQuantityDiscount(
      unitPrice, effectiveQuantity, product?.quantityDiscountMinQty, product?.quantityDiscountPercent,
    )

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: product?.name ?? 'No longer available',
      productSlug: product?.slug ?? null,
      sku: variant?.sku ?? product?.sku ?? null,
      variantLabel: await buildVariantLabel(event, item.variantId),
      imageUrl: variant?.imageUrl ?? null,
      quantity: item.quantity,
      available,
      stock,
      exceedsStock: available && item.quantity > stock,
      unitPrice,
      subtotal,
      quantityDiscountApplied: discountApplied,
      quantityDiscountMinQty: product?.quantityDiscountMinQty ?? null,
      quantityDiscountPercent: product?.quantityDiscountPercent ?? null,
    }
  }))

  const subtotal = hydratedItems.reduce((sum, i) => sum + i.subtotal, 0)
  const itemCount = hydratedItems.filter(i => i.available).reduce((sum, i) => sum + i.quantity, 0)

  return { id: cartId, items: hydratedItems, subtotal, itemCount }
}

export const cartService = {
  async get(event: H3Event) {
    const cart = await findExistingCart(event)
    if (!cart) return { id: null, items: [], subtotal: 0, itemCount: 0 }
    return hydrate(event, cart.id)
  },

  async addItem(event: H3Event, input: { productId: string, variantId?: string | null, quantity: number }) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw createError({ statusCode: 422, statusMessage: 'Quantity must be at least 1' })
    }

    const db = useDb(event)
    const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1)
    if (!product || product.status !== 'active' || product.deletedAt) {
      throw createError({ statusCode: 404, statusMessage: 'Product not available' })
    }

    let variant: typeof productVariants.$inferSelect | undefined
    if (input.variantId) {
      [variant] = await db.select().from(productVariants).where(eq(productVariants.id, input.variantId)).limit(1)
      if (!variant || variant.productId !== product.id || !variant.isActive) {
        throw createError({ statusCode: 422, statusMessage: 'Selected variant is not available' })
      }
    }

    const cart = await getOrCreateCart(event)
    const existing = await cartRepository.findItem(event, cart.id, input.productId, input.variantId ?? null)
    const stock = variant?.stock ?? 0
    const requestedTotal = (existing?.quantity ?? 0) + input.quantity

    if (stock < 1) {
      throw createError({ statusCode: 409, statusMessage: 'This item is out of stock' })
    }

    const finalQuantity = Math.min(requestedTotal, stock)
    await cartRepository.upsertItem(event, cart.id, input.productId, input.variantId ?? null, finalQuantity)

    return this.get(event)
  },

  async updateItemQuantity(event: H3Event, itemId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return this.removeItem(event, itemId)
    }

    const cart = await findExistingCart(event)
    if (!cart) throw createError({ statusCode: 404, statusMessage: 'Cart not found' })

    const items = await cartRepository.listItems(event, cart.id)
    const item = items.find(i => i.id === itemId)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Cart item not found' })

    const db = useDb(event)
    const variant = item.variantId
      ? (await db.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1))[0]
      : undefined
    const stock = variant?.stock ?? 0
    const clamped = Math.min(quantity, Math.max(stock, 0))

    if (clamped < 1) {
      await cartRepository.removeItem(event, itemId)
    }
    else {
      await cartRepository.upsertItem(event, cart.id, item.productId, item.variantId, clamped)
    }

    return this.get(event)
  },

  async removeItem(event: H3Event, itemId: string) {
    const cart = await findExistingCart(event)
    if (!cart) throw createError({ statusCode: 404, statusMessage: 'Cart not found' })
    await cartRepository.removeItem(event, itemId)
    return this.get(event)
  },

  async clear(event: H3Event) {
    const cart = await findExistingCart(event)
    if (cart) await cartRepository.clear(event, cart.id)
    return this.get(event)
  },

  /** Called right after login/registration to fold a guest cart into the customer's account cart. */
  async mergeGuestCartIntoCustomer(event: H3Event, customerProfileId: string) {
    const guestToken = getGuestToken(event)
    if (!guestToken) return

    const guestCart = await cartRepository.findActiveByGuestToken(event, guestToken)
    if (!guestCart) return

    const guestItems = await cartRepository.listItems(event, guestCart.id)
    if (!guestItems.length) {
      await cartRepository.remove(event, guestCart.id)
      return
    }

    let accountCart = await cartRepository.findActiveByCustomerProfileId(event, customerProfileId)
    if (!accountCart) {
      const id = await cartRepository.create(event, { customerProfileId })
      accountCart = await cartRepository.findById(event, id)
    }
    if (!accountCart) return

    for (const item of guestItems) {
      const existing = await cartRepository.findItem(event, accountCart.id, item.productId, item.variantId)
      const newQty = (existing?.quantity ?? 0) + item.quantity
      await cartRepository.upsertItem(event, accountCart.id, item.productId, item.variantId, newQty)
    }

    await cartRepository.remove(event, guestCart.id)
  },
}
