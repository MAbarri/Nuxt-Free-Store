import { and, eq, isNull } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { carts, cartItems } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export const cartRepository = {
  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(carts).where(eq(carts.id, id)).limit(1)
    return row ?? null
  },

  async findActiveByCustomerProfileId(event: H3Event, customerProfileId: string) {
    const db = useDb(event)
    const [row] = await db.select().from(carts)
      .where(and(eq(carts.customerProfileId, customerProfileId), eq(carts.status, 'active')))
      .limit(1)
    return row ?? null
  },

  async findActiveByGuestToken(event: H3Event, guestToken: string) {
    const db = useDb(event)
    const [row] = await db.select().from(carts)
      .where(and(eq(carts.guestToken, guestToken), eq(carts.status, 'active')))
      .limit(1)
    return row ?? null
  },

  async create(event: H3Event, owner: { customerProfileId?: string, guestToken?: string }) {
    const db = useDb(event)
    const id = generateId('cart')
    const now = new Date()
    await db.insert(carts).values({
      id,
      customerProfileId: owner.customerProfileId ?? null,
      guestToken: owner.guestToken ?? null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    return id
  },

  async markConverted(event: H3Event, id: string) {
    const db = useDb(event)
    await db.update(carts).set({ status: 'converted', updatedAt: new Date() }).where(eq(carts.id, id))
  },

  /**
   * Deletes a cart (and its items, via cascade). Used once a guest cart has
   * been merged into an account cart — nothing of value is left behind, and
   * `guestToken` carries a unique index, so a stale merged cart would
   * otherwise permanently block that guest identity from ever starting a
   * fresh cart again.
   */
  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(carts).where(eq(carts.id, id))
  },

  async listItems(event: H3Event, cartId: string) {
    const db = useDb(event)
    return db.select().from(cartItems).where(eq(cartItems.cartId, cartId))
  },

  async findItem(event: H3Event, cartId: string, productId: string, variantId: string | null) {
    const db = useDb(event)
    const conditions = [eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)]
    conditions.push(variantId ? eq(cartItems.variantId, variantId) : isNull(cartItems.variantId))
    const [row] = await db.select().from(cartItems).where(and(...conditions)).limit(1)
    return row ?? null
  },

  async upsertItem(event: H3Event, cartId: string, productId: string, variantId: string | null, quantity: number) {
    const existing = await this.findItem(event, cartId, productId, variantId)
    const db = useDb(event)
    const now = new Date()
    if (existing) {
      await db.update(cartItems).set({ quantity, updatedAt: now }).where(eq(cartItems.id, existing.id))
      return existing.id
    }
    const id = generateId('citem')
    await db.insert(cartItems).values({ id, cartId, productId, variantId, quantity, createdAt: now, updatedAt: now })
    return id
  },

  async removeItem(event: H3Event, itemId: string) {
    const db = useDb(event)
    await db.delete(cartItems).where(eq(cartItems.id, itemId))
  },

  async clear(event: H3Event, cartId: string) {
    const db = useDb(event)
    await db.delete(cartItems).where(eq(cartItems.cartId, cartId))
  },
}
