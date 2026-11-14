import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { customerProfiles, addresses, orders } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'
import { normalizePhoneMA } from '../utils/phone'

export interface CustomerListFilters {
  search?: string
  page?: number
  pageSize?: number
}

export interface FindOrCreateCustomerInput {
  phone: string
  fullName: string
  email?: string | null
}

export const customersRepository = {
  async list(event: H3Event, filters: CustomerListFilters = {}) {
    const db = useDb(event)
    const page = Math.max(filters.page ?? 1, 1)
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100)

    const conditions = []
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(or(
        like(customerProfiles.fullName, term),
        like(customerProfiles.email, term),
        like(customerProfiles.phone, term),
      )!)
    }
    const where = conditions.length ? and(...conditions) : undefined

    const [rows, [{ count }]] = await Promise.all([
      db.select({
        profileId: customerProfiles.id,
        userId: customerProfiles.userId,
        fullName: customerProfiles.fullName,
        email: customerProfiles.email,
        phone: customerProfiles.phone,
        createdAt: customerProfiles.createdAt,
      })
        .from(customerProfiles)
        .where(where)
        .orderBy(desc(customerProfiles.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` })
        .from(customerProfiles)
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
        hasAccount: r.userId !== null,
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
      userId: customerProfiles.userId,
      fullName: customerProfiles.fullName,
      email: customerProfiles.email,
      phone: customerProfiles.phone,
      notes: customerProfiles.notes,
      createdAt: customerProfiles.createdAt,
    })
      .from(customerProfiles)
      .where(eq(customerProfiles.id, profileId))
      .limit(1)
    if (!row) return null
    return { ...row, hasAccount: row.userId !== null }
  },

  async findByPhone(event: H3Event, normalizedPhone: string) {
    const db = useDb(event)
    const [row] = await db.select().from(customerProfiles).where(eq(customerProfiles.phone, normalizedPhone)).limit(1)
    return row ?? null
  },

  /**
   * Resolves a customer identity by phone number — the canonical,
   * account-free key. Updates the latest known name/email ("latest wins")
   * when a match is found, or inserts a new profile. Optionally links a
   * logged-in user's id onto the profile. Idempotent and safe to call on
   * every checkout.
   */
  async findOrCreateByPhone(event: H3Event, input: FindOrCreateCustomerInput, userId?: string | null) {
    const db = useDb(event)
    const phone = normalizePhoneMA(input.phone)
    const now = new Date()

    const existing = await this.findByPhone(event, phone)
    if (existing) {
      await db.update(customerProfiles).set({
        fullName: input.fullName || existing.fullName,
        email: input.email ?? existing.email,
        userId: existing.userId ?? userId ?? null,
        updatedAt: now,
      }).where(eq(customerProfiles.id, existing.id))
      return existing.id
    }

    const id = generateId('cprof')
    await db.insert(customerProfiles).values({
      id,
      userId: userId ?? null,
      phone,
      fullName: input.fullName,
      email: input.email ?? null,
      createdAt: now,
      updatedAt: now,
    })
    return id
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

  /**
   * One-time (but safely re-runnable) backfill: finds every order without a
   * linked customer profile, groups by normalized phone, find-or-creates a
   * profile per group (name/email from that group's most recent order), and
   * attaches those orders to it.
   */
  async backfillFromOrders(event: H3Event) {
    const db = useDb(event)
    const orphanOrders = await db.select({
      id: orders.id,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerEmail: orders.customerEmail,
      createdAt: orders.createdAt,
    })
      .from(orders)
      .where(sql`${orders.customerProfileId} IS NULL`)
      .orderBy(desc(orders.createdAt))

    if (!orphanOrders.length) return { ordersUpdated: 0, profilesCreated: 0 }

    const groups = new Map<string, typeof orphanOrders>()
    for (const order of orphanOrders) {
      const phone = normalizePhoneMA(order.customerPhone)
      const group = groups.get(phone)
      if (group) group.push(order)
      else groups.set(phone, [order])
    }

    let ordersUpdated = 0
    let profilesCreated = 0

    for (const [, group] of groups) {
      // `group` is already ordered most-recent-first (inherited from the query above).
      const latest = group[0]!
      const existingBefore = await this.findByPhone(event, normalizePhoneMA(latest.customerPhone))
      const profileId = await this.findOrCreateByPhone(event, {
        phone: latest.customerPhone,
        fullName: latest.customerName,
        email: latest.customerEmail,
      })
      if (!existingBefore) profilesCreated++

      await db.update(orders)
        .set({ customerProfileId: profileId })
        .where(inArray(orders.id, group.map(o => o.id)))
      ordersUpdated += group.length
    }

    return { ordersUpdated, profilesCreated }
  },
}
