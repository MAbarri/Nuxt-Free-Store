import { useDb } from '../utils/db'
import { storeSettings } from '../database/schema'
import type { H3Event } from 'h3'

const DEFAULTS = {
  storeName: 'Atelier',
  tagline: 'Thoughtfully made clothing, delivered to your door.',
  logoUrl: null as string | null,
  accentColor: '#bb6540',
  defaultShippingFee: 500, // minor currency unit (cents)
  hero: {
    title: 'New season, quietly considered',
    subtitle: 'Clothing made from natural fibers, designed to last beyond the season.',
    imageUrl: null as string | null,
    ctaLabel: 'Shop the collection',
    ctaHref: '/products',
  },
  promo: {
    title: 'Cash on delivery, everywhere we ship',
    subtitle: 'Pay when your order arrives — no card required.',
  },
}

export type StoreSettings = typeof DEFAULTS

export const settingsService = {
  /** Public, non-sensitive settings safe to expose to the storefront. */
  async getPublicSettings(event: H3Event): Promise<StoreSettings> {
    const db = useDb(event)
    const rows = await db.select().from(storeSettings)
    const overrides = Object.fromEntries(rows.map(row => [row.key, row.value]))
    return { ...DEFAULTS, ...overrides }
  },

  async set(event: H3Event, key: keyof StoreSettings, value: unknown): Promise<void> {
    const db = useDb(event)
    const now = new Date()
    await db
      .insert(storeSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: now } })
  },

  /** Admin-facing partial update — writes only the keys provided. */
  async updateMany(event: H3Event, input: Partial<StoreSettings>): Promise<StoreSettings> {
    for (const [key, value] of Object.entries(input)) {
      await this.set(event, key as keyof StoreSettings, value)
    }
    return this.getPublicSettings(event)
  },
}
