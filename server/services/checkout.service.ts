import { createError, type H3Event } from 'h3'
import { cartService } from './cart.service'
import { shippingService } from './shipping.service'
import { inventoryService } from './inventory.service'
import { ordersRepository, type OrderItemInput } from '../repositories/orders.repository'
import { ordersService } from './orders.service'
import { analyticsService } from './analytics.service'
import { productsRepository } from '../repositories/products.repository'
import { variantsRepository } from '../repositories/variants.repository'
import { resolveCustomerProfileId } from '../utils/customer'

export interface CheckoutInput {
  fullName: string
  phone: string
  email?: string
  city: string
  addressLine: string
  deliveryInstructions?: string
}

export interface DirectOrderInput extends CheckoutInput {
  productId: string
  variantId: string
  quantity: number
}

function buildOrderNumber(): string {
  const date = new Date()
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `ORD-${datePart}-${randomPart}`
}

async function generateUniqueOrderNumber(event: H3Event): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = buildOrderNumber()
    const existing = await ordersRepository.findByOrderNumber(event, candidate)
    if (!existing) return candidate
  }
  throw createError({ statusCode: 500, statusMessage: 'Failed to generate order number, please try again' })
}

async function assertCartIsOrderable(cart: Awaited<ReturnType<typeof cartService.get>>) {
  if (!cart.items.length) {
    throw createError({ statusCode: 422, statusMessage: 'Your cart is empty' })
  }

  const unavailable = cart.items.filter(i => !i.available)
  if (unavailable.length) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Some items in your cart are no longer available. Please remove them to continue.',
      data: { itemIds: unavailable.map(i => i.id) },
    })
  }

  const exceeding = cart.items.filter(i => i.exceedsStock)
  if (exceeding.length) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Some items in your cart exceed available stock. Please update the quantities to continue.',
      data: { itemIds: exceeding.map(i => i.id) },
    })
  }
}

export const checkoutService = {
  /** Live totals for a given delivery city, without creating an order — used by the checkout page as the customer types. */
  async quote(event: H3Event, city: string) {
    const cart = await cartService.get(event)
    await assertCartIsOrderable(cart)

    const { fee, freeShippingApplied } = await shippingService.calculateFee(event, city, cart.subtotal)
    return {
      subtotal: cart.subtotal,
      shippingFee: fee,
      freeShippingApplied,
      total: cart.subtotal + fee,
    }
  },

  async createOrder(event: H3Event, input: CheckoutInput) {
    const cart = await cartService.get(event)
    await assertCartIsOrderable(cart)

    const { fee: shippingFee } = await shippingService.calculateFee(event, input.city, cart.subtotal)
    const total = cart.subtotal + shippingFee

    // Reserve the order number before touching stock, so a failed insert
    // never leaves us having decremented inventory for nothing.
    const orderNumber = await generateUniqueOrderNumber(event)
    const customerProfileId = await resolveCustomerProfileId(event)

    // Decrement stock for every line item through the same concurrency-safe
    // path used everywhere else, rolling back whatever already succeeded if
    // any item sells out mid-checkout (e.g. a concurrent order wins the race).
    const decremented: Array<{ variantId: string, quantity: number }> = []
    try {
      for (const item of cart.items) {
        if (!item.variantId) continue
        await inventoryService.adjustStock(event, item.variantId, -item.quantity, 'order_placed')
        decremented.push({ variantId: item.variantId, quantity: item.quantity })
      }
    }
    catch (error) {
      for (const d of decremented.reverse()) {
        await inventoryService.adjustStock(event, d.variantId, d.quantity, 'manual_adjustment', {
          note: 'Automatic rollback: checkout failed after partial stock reservation',
        }).catch(() => {})
      }
      throw createError({
        statusCode: 409,
        statusMessage: 'One or more items sold out while placing your order. Please review your cart and try again.',
        cause: error,
      })
    }

    const items: OrderItemInput[] = cart.items.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantLabel: item.variantLabel,
      sku: item.sku,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    }))

    const orderId = await ordersRepository.create(event, {
      orderNumber,
      customerProfileId,
      customerName: input.fullName,
      customerPhone: input.phone,
      customerEmail: input.email || null,
      city: input.city,
      addressLine: input.addressLine,
      deliveryInstructions: input.deliveryInstructions || null,
      subtotal: cart.subtotal,
      shippingFee,
      total,
      items,
    })

    await cartService.clear(event)

    // Fire-and-forget: trackPurchase never throws, and we don't want an
    // analytics-provider hiccup to add latency to the checkout response.
    void analyticsService.trackPurchase(event, {
      orderId,
      total,
      currency: 'MAD',
      productIds: cart.items.map(item => item.productId),
      numItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      email: input.email || null,
      phone: input.phone,
    })

    return ordersService.getDetail(event, orderId)
  },

  /**
   * Places an order for a single product/variant directly, with no cart
   * involved — used by Landing-style product pages' embedded order form.
   * Reuses the same stock-decrement, shipping-fee, and order-number logic
   * as `createOrder`, scoped to a single line item.
   */
  async createDirectOrder(event: H3Event, input: DirectOrderInput) {
    const product = await productsRepository.findById(event, input.productId)
    if (!product || product.status !== 'active') {
      throw createError({ statusCode: 404, statusMessage: 'Product not found' })
    }
    if (product.layoutStyle !== 'landing') {
      throw createError({ statusCode: 422, statusMessage: 'This product does not support direct ordering' })
    }

    const variants = await variantsRepository.listByProduct(event, product.id)
    const variant = variants.find(v => v.id === input.variantId)
    if (!variant) {
      throw createError({ statusCode: 404, statusMessage: 'Variant not found' })
    }
    if (!variant.isActive || variant.stock < input.quantity) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This item is no longer available in the requested quantity',
      })
    }

    const unitPrice = variant.price ?? product.basePrice
    const subtotal = unitPrice * input.quantity

    const { fee: shippingFee } = await shippingService.calculateFee(event, input.city, subtotal)
    const total = subtotal + shippingFee

    const orderNumber = await generateUniqueOrderNumber(event)
    const customerProfileId = await resolveCustomerProfileId(event)

    await inventoryService.adjustStock(event, variant.id, -input.quantity, 'order_placed')

    const variantLabel = variant.attributes.map(a => `${a.attributeName}: ${a.value}`).join(' / ') || null

    const item: OrderItemInput = {
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      variantLabel,
      sku: variant.sku,
      unitPrice,
      quantity: input.quantity,
      subtotal,
    }

    let orderId: string
    try {
      orderId = await ordersRepository.create(event, {
        orderNumber,
        customerProfileId,
        customerName: input.fullName,
        customerPhone: input.phone,
        customerEmail: input.email || null,
        city: input.city,
        addressLine: input.addressLine,
        deliveryInstructions: input.deliveryInstructions || null,
        subtotal,
        shippingFee,
        total,
        items: [item],
      })
    }
    catch (error) {
      await inventoryService.adjustStock(event, variant.id, input.quantity, 'manual_adjustment', {
        note: 'Automatic rollback: direct order failed after stock reservation',
      }).catch(() => {})
      throw createError({
        statusCode: 409,
        statusMessage: 'Could not place your order. Please try again.',
        cause: error,
      })
    }

    void analyticsService.trackPurchase(event, {
      orderId,
      total,
      currency: 'MAD',
      productIds: [product.id],
      numItems: input.quantity,
      email: input.email || null,
      phone: input.phone,
    })

    return ordersService.getDetail(event, orderId)
  },
}
