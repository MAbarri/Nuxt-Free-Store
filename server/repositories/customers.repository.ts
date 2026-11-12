import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users, customerProfiles, addresses, orders } from '../database/schema'
import { useDb } from '../utils/db'

export interface CustomerListFilters {
  search?: string
  page?: number
  pageSize?: number
}

export const customersRepository = {
  async list(event: H3Event, filters: CustomerListFilters = {}) {
    const db = useDb(event)
    const page = Math.max(filters.page ?? 1, 1)
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100)

    const conditions = [eq(users.role, 'customer')]
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(or(
        like(users.fullName, term),
        like(users.email, term),
        like(users.phone, term),
      )!)
    }
    const where = and(...conditions)

    const [rows, [{ count }]] = await Promise.all([
      db.select({
        profileId: customerProfiles.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
      })
        .from(customerProfiles)
        .innerJoin(users, eq(users.id, customerProfiles.userId))
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` })
        .from(customerProfiles)
        .innerJoin(users, eq(users.id, customerProfiles.userId))
        .where(where),
    ])

    if (!rows.length) return { rows: [], total: Number(count), page, pageSize }

    const profileIds = rows.map(r => r.profileId)
    const totals = await db.select({
      customerProfileId: orders.customerProfileId,
      totalOrders: sql<number>`count(*)`,
      totalSpent: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    })
      .from(orders)
      .where(inArray(orders.customerProfileId, profileIds))
      .groupBy(orders.customerProfileId)

    const totalsByProfile = new Map(totals.map(t => [t.customerProfileId, t]))

    return {
      rows: rows.map(r => ({
        ...r,
        totalOrders: Number(totalsByProfile.get(r.profileId)?.totalOrders ?? 0),
        totalSpent: Number(totalsByProfile.get(r.profileId)?.totalSpent ?? 0),
      })),
      total: Number(count),
      page,
      pageSize,
    }
  },

  async findProfileById(event: H3Event, profileId: string) {
    const db = useDb(event)
    const [row] = await db.select({
      profileId: customerProfiles.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      notes: customerProfiles.notes,
      createdAt: users.createdAt,
    })
      .from(customerProfiles)
      .innerJoin(users, eq(users.id, customerProfiles.userId))
      .where(eq(customerProfiles.id, profileId))
      .limit(1)
    return row ?? null
  },

  async updateNotes(event: H3Event, profileId: string, notes: string | null) {
    const db = useDb(event)
    await db.update(customerProfiles).set({ notes, updatedAt: new Date() }).where(eq(customerProfiles.id, profileId))
  },

  async listAddresses(event: H3Event, profileId: string) {
    const db = useDb(event)
    return db.select().from(addresses)
      .where(eq(addresses.customerProfileId, profileId))
      .orderBy(desc(addresses.isDefault), asc(addresses.label))
  },

  async listOrders(event: H3Event, profileId: string) {
    const db = useDb(event)
    return db.select().from(orders)
      .where(eq(orders.customerProfileId, profileId))
      .orderBy(desc(orders.createdAt))
  },

  async totals(event: H3Event, profileId: string) {
    const db = useDb(event)
    const [row] = await db.select({
      totalOrders: sql<number>`count(*)`,
      totalSpent: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    }).from(orders).where(eq(orders.customerProfileId, profileId))
    return { totalOrders: Number(row?.totalOrders ?? 0), totalSpent: Number(row?.totalSpent ?? 0) }
  },
}
