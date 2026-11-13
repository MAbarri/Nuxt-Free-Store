import { and, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { orders, orderItems, orderStatusHistory } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface OrderItemInput {
  productId: string | null
  variantId: string | null
  productName: string
  variantLabel: string | null
  sku: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export interface CreateOrderInput {
  orderNumber: string
  customerProfileId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  city: string
  addressLine: string
  deliveryInstructions: string | null
  subtotal: number
  shippingFee: number
  total: number
  items: OrderItemInput[]
}

export const ordersRepository = {
  async create(event: H3Event, input: CreateOrderInput) {
    const db = useDb(event)
    const id = generateId('ord')
    const now = new Date()

    await db.insert(orders).values({
      id,
      orderNumber: input.orderNumber,
      customerProfileId: input.customerProfileId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      city: input.city,
      addressLine: input.addressLine,
      deliveryInstructions: input.deliveryInstructions,
      subtotal: input.subtotal,
      shippingFee: input.shippingFee,
      total: input.total,
      currency: 'MAD',
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
      status: 'pending_confirmation',
      createdAt: now,
      updatedAt: now,
    })

    for (const item of input.items) {
      await db.insert(orderItems).values({
        id: generateId('oitem'),
        orderId: id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantLabel: item.variantLabel,
        sku: item.sku,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        createdAt: now,
      })
    }

    await db.insert(orderStatusHistory).values({
      id: generateId('oshist'),
      orderId: id,
      fromStatus: null,
      toStatus: 'pending_confirmation',
      note: 'Order placed',
      createdAt: now,
    })

    return id
  },

  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
    return row ?? null
  },

  async findByOrderNumber(event: H3Event, orderNumber: string) {
    const db = useDb(event)
    const [row] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
    return row ?? null
  },

  async listItems(event: H3Event, orderId: string) {
    const db = useDb(event)
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  },

  async listStatusHistory(event: H3Event, orderId: string) {
    const db = useDb(event)
    return db.select().from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(desc(orderStatusHistory.createdAt))
  },

  async list(event: H3Event, filters: OrderListFilters = {}) {
    const db = useDb(event)
    const page = Math.max(filters.page ?? 1, 1)
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100)

    const conditions = []
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(or(
        like(orders.orderNumber, term),
        like(orders.customerName, term),
        like(orders.customerPhone, term),
      ))
    }
    if (filters.status) conditions.push(eq(orders.status, filters.status))
    if (filters.dateFrom) conditions.push(gte(orders.createdAt, filters.dateFrom))
    if (filters.dateTo) conditions.push(lte(orders.createdAt, filters.dateTo))

    const where = conditions.length ? and(...conditions) : undefined

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(orders).where(where)
        .orderBy(desc(orders.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` }).from(orders).where(where),
    ])

    return { rows, total: Number(count), page, pageSize }
  },

  async update(event: H3Event, id: string, fields: Partial<{
    status: typeof orders.$inferSelect['status']
    paymentStatus: typeof orders.$inferSelect['paymentStatus']
    internalNotes: string | null
    trackingReference: string | null
  }>) {
    const db = useDb(event)
    await db.update(orders).set({ ...fields, updatedAt: new Date() }).where(eq(orders.id, id))
  },

  async addStatusHistory(event: H3Event, input: {
    orderId: string
    fromStatus: typeof orders.$inferSelect['status'] | null
    toStatus: typeof orders.$inferSelect['status']
    note?: string | null
    createdByUserId?: string | null
  }) {
    const db = useDb(event)
    await db.insert(orderStatusHistory).values({
      id: generateId('oshist'),
      orderId: input.orderId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      note: input.note ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: new Date(),
    })
  },
}

export interface OrderListFilters {
  search?: string
  status?: typeof orders.$inferSelect['status']
  dateFrom?: Date
  dateTo?: Date
  page?: number
  pageSize?: number
}
