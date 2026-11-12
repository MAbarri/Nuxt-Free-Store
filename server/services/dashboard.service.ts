import { desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { orders, orderItems } from '../database/schema'
import { useDb } from '../utils/db'
import { inventoryService } from './inventory.service'

// Orders that didn't result in revenue (never delivered/collected, or reversed).
const REVENUE_EXCLUDED_STATUSES = ['cancelled', 'returned', 'failed_delivery'] as const
// Orders still moving through fulfillment — placed but not yet delivered or ended.
const IN_PROGRESS_STATUSES = ['pending_confirmation', 'confirmed', 'processing', 'shipped'] as const

export const dashboardService = {
  async overview(event: H3Event) {
    const db = useDb(event)

    const [
      [{ totalOrders }],
      [{ totalRevenue }],
      [{ pendingOrders }],
      [{ awaitingConfirmation }],
      [{ deliveredOrders }],
    ] = await Promise.all([
      db.select({ totalOrders: sql<number>`count(*)` }).from(orders),
      db.select({ totalRevenue: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
        .from(orders).where(notInArray(orders.status, REVENUE_EXCLUDED_STATUSES)),
      db.select({ pendingOrders: sql<number>`count(*)` })
        .from(orders).where(inArray(orders.status, IN_PROGRESS_STATUSES)),
      db.select({ awaitingConfirmation: sql<number>`count(*)` })
        .from(orders).where(eq(orders.status, 'pending_confirmation')),
      db.select({ deliveredOrders: sql<number>`count(*)` })
        .from(orders).where(eq(orders.status, 'delivered')),
    ])

    const recentOrders = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      total: orders.total,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    }).from(orders).orderBy(desc(orders.createdAt)).limit(8)

    const bestSellersRaw = await db.select({
      productId: orderItems.productId,
      name: sql<string>`MAX(${orderItems.productName})`,
      quantitySold: sql<number>`SUM(${orderItems.quantity})`,
    })
      .from(orderItems)
      .groupBy(orderItems.productId)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(5)

    const lowStock = await inventoryService.lowStock(event, 5)

    return {
      totalOrders: Number(totalOrders),
      totalRevenue: Number(totalRevenue),
      pendingOrders: Number(pendingOrders),
      awaitingConfirmation: Number(awaitingConfirmation),
      deliveredOrders: Number(deliveredOrders),
      recentOrders,
      bestSellers: bestSellersRaw
        .filter(b => b.productId)
        .map(b => ({ productId: b.productId, name: b.name, quantitySold: Number(b.quantitySold) })),
      lowStock: lowStock.slice(0, 8),
    }
  },
}
