import { and, eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { productTranslations } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'
import type { TranslatableLocale } from '../utils/locale'

export interface ProductTranslationInput {
  name?: string | null
  shortDescription?: string | null
  description?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  landingBenefits?: Array<{ icon?: string, text: string }> | null
  landingBlockCaptions?: Array<string | null> | null
}

export const productTranslationsRepository = {
  async listByProduct(event: H3Event, productId: string) {
    const db = useDb(event)
    return db.select().from(productTranslations).where(eq(productTranslations.productId, productId))
  },

  /** Convenience map keyed by locale, e.g. `{ en: {...}, ar: {...} }`. */
  async mapByProduct(event: H3Event, productId: string): Promise<Partial<Record<TranslatableLocale, typeof productTranslations.$inferSelect>>> {
    const rows = await this.listByProduct(event, productId)
    const map: Partial<Record<TranslatableLocale, typeof productTranslations.$inferSelect>> = {}
    for (const row of rows) map[row.locale] = row
    return map
  },

  /** Bulk variant of `mapByProduct`, for list views that need translations for many products at once. */
  async listByProducts(event: H3Event, productIds: string[]) {
    const db = useDb(event)
    if (!productIds.length) return []
    return db.select().from(productTranslations).where(inArray(productTranslations.productId, productIds))
  },

  async findOne(event: H3Event, productId: string, locale: TranslatableLocale) {
    const db = useDb(event)
    const [row] = await db.select().from(productTranslations)
      .where(and(eq(productTranslations.productId, productId), eq(productTranslations.locale, locale)))
      .limit(1)
    return row ?? null
  },

  async upsert(event: H3Event, productId: string, locale: TranslatableLocale, input: ProductTranslationInput) {
    const db = useDb(event)
    const existing = await this.findOne(event, productId, locale)
    const now = new Date()

    if (existing) {
      await db.update(productTranslations).set({ ...input, updatedAt: now }).where(eq(productTranslations.id, existing.id))
      return this.findOne(event, productId, locale)
    }

    const id = generateId('ptr')
    await db.insert(productTranslations).values({
      id,
      productId,
      locale,
      name: input.name ?? null,
      shortDescription: input.shortDescription ?? null,
      description: input.description ?? null,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      landingBenefits: input.landingBenefits ?? null,
      landingBlockCaptions: input.landingBlockCaptions ?? null,
      createdAt: now,
      updatedAt: now,
    })
    return this.findOne(event, productId, locale)
  },
}
