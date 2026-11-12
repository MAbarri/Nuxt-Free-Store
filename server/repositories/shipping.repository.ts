import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { shippingZones, shippingRates } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export const shippingRepository = {
  async listZones(event: H3Event) {
    const db = useDb(event)
    return db.select().from(shippingZones)
  },

  async findZoneById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(shippingZones).where(eq(shippingZones.id, id)).limit(1)
    return row ?? null
  },

  async createZone(event: H3Event, input: { name: string, freeShippingThreshold?: number | null, isActive?: boolean }) {
    const db = useDb(event)
    const id = generateId('zone')
    const now = new Date()
    await db.insert(shippingZones).values({
      id,
      name: input.name,
      freeShippingThreshold: input.freeShippingThreshold ?? null,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    return id
  },

  async updateZone(event: H3Event, id: string, input: Partial<{ name: string, freeShippingThreshold: number | null, isActive: boolean }>) {
    const db = useDb(event)
    await db.update(shippingZones).set({ ...input, updatedAt: new Date() }).where(eq(shippingZones.id, id))
  },

  async removeZone(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(shippingZones).where(eq(shippingZones.id, id))
  },

  async listRates(event: H3Event, zoneId?: string) {
    const db = useDb(event)
    if (zoneId) return db.select().from(shippingRates).where(eq(shippingRates.zoneId, zoneId))
    return db.select().from(shippingRates)
  },

  /** Active rate for a city, case-insensitively, with its zone — used for both checkout and admin management. */
  async findActiveRateByCity(event: H3Event, city: string) {
    const db = useDb(event)
    const rows = await db.select({ rate: shippingRates, zone: shippingZones })
      .from(shippingRates)
      .innerJoin(shippingZones, eq(shippingZones.id, shippingRates.zoneId))
      .where(and(eq(shippingRates.isActive, true), eq(shippingZones.isActive, true)))
    const match = rows.find(r => r.rate.city.trim().toLowerCase() === city.trim().toLowerCase())
    return match ?? null
  },

  async countRates(event: H3Event) {
    const db = useDb(event)
    const rows = await db.select().from(shippingRates)
    return rows.length
  },

  async createRate(event: H3Event, input: { zoneId: string, city: string, fee: number, isActive?: boolean }) {
    const db = useDb(event)
    const id = generateId('rate')
    const now = new Date()
    await db.insert(shippingRates).values({
      id,
      zoneId: input.zoneId,
      city: input.city,
      fee: input.fee,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    return id
  },

  async updateRate(event: H3Event, id: string, input: Partial<{ city: string, fee: number, isActive: boolean }>) {
    const db = useDb(event)
    await db.update(shippingRates).set({ ...input, updatedAt: new Date() }).where(eq(shippingRates.id, id))
  },

  async removeRate(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(shippingRates).where(eq(shippingRates.id, id))
  },

  async findRateById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(shippingRates).where(eq(shippingRates.id, id)).limit(1)
    return row ?? null
  },
}
