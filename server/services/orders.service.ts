import { createError, type H3Event } from 'h3'
import { ordersRepository, type OrderListFilters } from '../repositories/orders.repository'
import { inventoryService } from './inventory.service'

type OrderStatus = 'pending_confirmation' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed_delivery' | 'returned'
type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

// Entering either of these statuses returns the merchandise to stock. Leaving
// FROM one of these (e.g. an accidental cancellation being reversed) is not
// auto-re-decremented — an admin correcting a mistake should do so deliberately
// via a manual inventory adjustment, not have stock silently vanish again.
const STOCK_RESTORING_STATUSES: OrderStatus[] = ['cancelled', 'returned']

export const ordersService = {
  list(event: H3Event, filters: OrderListFilters) {
    return ordersRepository.list(event, filters)
  },

  async getDetail(event: H3Event, id: string) {
    const order = await ordersRepository.findById(event, id)
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })

    const [items, history] = await Promise.all([
      ordersRepository.listItems(event, order.id),
      ordersRepository.listStatusHistory(event, order.id),
    ])

    return { ...order, items, history }
  },

  async updateStatus(event: H3Event, id: string, newStatus: OrderStatus, opts: { note?: string, adminUserId?: string } = {}) {
    const order = await ordersRepository.findById(event, id)
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })

    if (order.status === newStatus) return this.getDetail(event, id)

    const wasRestored = STOCK_RESTORING_STATUSES.includes(order.status)
    const shouldRestore = STOCK_RESTORING_STATUSES.includes(newStatus) && !wasRestored

    if (shouldRestore) {
      const items = await ordersRepository.listItems(event, id)
      for (const item of items) {
        if (!item.variantId) continue
        await inventoryService.adjustStock(event, item.variantId, item.quantity, 'order_cancelled', {
          note: `Restored by order ${order.orderNumber} → ${newStatus}`,
          orderId: id,
          createdByUserId: opts.adminUserId,
        })
      }
    }

    await ordersRepository.update(event, id, { status: newStatus })
    await ordersRepository.addStatusHistory(event, {
      orderId: id,
      fromStatus: order.status,
      toStatus: newStatus,
      note: opts.note,
      createdByUserId: opts.adminUserId,
    })

    return this.getDetail(event, id)
  },

  async cancel(event: H3Event, id: string, opts: { note?: string, adminUserId?: string } = {}) {
    return this.updateStatus(event, id, 'cancelled', opts)
  },

  async updatePaymentStatus(event: H3Event, id: string, paymentStatus: PaymentStatus) {
    const order = await ordersRepository.findById(event, id)
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    await ordersRepository.update(event, id, { paymentStatus })
    return this.getDetail(event, id)
  },

  async updateNotes(event: H3Event, id: string, internalNotes: string) {
    const order = await ordersRepository.findById(event, id)
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    await ordersRepository.update(event, id, { internalNotes: internalNotes || null })
    return this.getDetail(event, id)
  },

  async updateTracking(event: H3Event, id: string, trackingReference: string) {
    const order = await ordersRepository.findById(event, id)
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })
    await ordersRepository.update(event, id, { trackingReference: trackingReference || null })
    return this.getDetail(event, id)
  },
}
