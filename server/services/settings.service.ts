import { useDb } from '../utils/db'
import { storeSettings } from '../database/schema'
import type { H3Event } from 'h3'

const DEFAULTS = {
  storeName: 'Atelier',
  tagline: 'Thoughtfully made clothing, delivered to your door.',
  logoUrl: null as string | null,
  accentColor: '#bb6540',
  defaultShippingFee: 500, // minor currency unit (cents)
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
}
