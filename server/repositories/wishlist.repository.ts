import { and, eq, isNull } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { wishlists, wishlistItems } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export const wishlistRepository = {
  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(wishlists).where(eq(wishlists.id, id)).limit(1)
    return row ?? null
  },

  async findByCustomerProfileId(event: H3Event, customerProfileId: string) {
    const db = useDb(event)
    const [row] = await db.select().from(wishlists).where(eq(wishlists.customerProfileId, customerProfileId)).limit(1)
    return row ?? null
  },

  async findByGuestToken(event: H3Event, guestToken: string) {
    const db = useDb(event)
    const [row] = await db.select().from(wishlists).where(eq(wishlists.guestToken, guestToken)).limit(1)
    return row ?? null
  },

  async create(event: H3Event, owner: { customerProfileId?: string, guestToken?: string }) {
    const db = useDb(event)
    const id = generateId('wish')
    await db.insert(wishlists).values({
      id,
      customerProfileId: owner.customerProfileId ?? null,
      guestToken: owner.guestToken ?? null,
      createdAt: new Date(),
    })
    return id
  },

  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(wishlists).where(eq(wishlists.id, id))
  },

  async listItems(event: H3Event, wishlistId: string) {
    const db = useDb(event)
    return db.select().from(wishlistItems).where(eq(wishlistItems.wishlistId, wishlistId))
  },

  async findItem(event: H3Event, wishlistId: string, productId: string, variantId: string | null) {
    const db = useDb(event)
    const conditions = [eq(wishlistItems.wishlistId, wishlistId), eq(wishlistItems.productId, productId)]
    conditions.push(variantId ? eq(wishlistItems.variantId, variantId) : isNull(wishlistItems.variantId))
    const [row] = await db.select().from(wishlistItems).where(and(...conditions)).limit(1)
    return row ?? null
  },

  async addItem(event: H3Event, wishlistId: string, productId: string, variantId: string | null) {
    const existing = await this.findItem(event, wishlistId, productId, variantId)
    if (existing) return existing.id
    const db = useDb(event)
    const id = generateId('witem')
    await db.insert(wishlistItems).values({ id, wishlistId, productId, variantId, createdAt: new Date() })
    return id
  },

  async removeItemByProduct(event: H3Event, wishlistId: string, productId: string) {
    const db = useDb(event)
    await db.delete(wishlistItems).where(and(eq(wishlistItems.wishlistId, wishlistId), eq(wishlistItems.productId, productId)))
  },
}
