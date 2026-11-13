import { and, eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { categoryTranslations } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'
import type { TranslatableLocale } from '../utils/locale'

export interface CategoryTranslationInput {
  name?: string | null
  description?: string | null
}

export const categoryTranslationsRepository = {
  async listByCategory(event: H3Event, categoryId: string) {
    const db = useDb(event)
    return db.select().from(categoryTranslations).where(eq(categoryTranslations.categoryId, categoryId))
  },

  async mapByCategory(event: H3Event, categoryId: string): Promise<Partial<Record<TranslatableLocale, typeof categoryTranslations.$inferSelect>>> {
    const rows = await this.listByCategory(event, categoryId)
    const map: Partial<Record<TranslatableLocale, typeof categoryTranslations.$inferSelect>> = {}
    for (const row of rows) map[row.locale] = row
    return map
  },

  async listByCategories(event: H3Event, categoryIds: string[]) {
    const db = useDb(event)
    if (!categoryIds.length) return []
    return db.select().from(categoryTranslations).where(inArray(categoryTranslations.categoryId, categoryIds))
  },

  async findOne(event: H3Event, categoryId: string, locale: TranslatableLocale) {
    const db = useDb(event)
    const [row] = await db.select().from(categoryTranslations)
      .where(and(eq(categoryTranslations.categoryId, categoryId), eq(categoryTranslations.locale, locale)))
      .limit(1)
    return row ?? null
  },

  async upsert(event: H3Event, categoryId: string, locale: TranslatableLocale, input: CategoryTranslationInput) {
    const db = useDb(event)
    const existing = await this.findOne(event, categoryId, locale)
    const now = new Date()

    if (existing) {
      await db.update(categoryTranslations).set({ ...input, updatedAt: now }).where(eq(categoryTranslations.id, existing.id))
      return this.findOne(event, categoryId, locale)
    }

    const id = generateId('ctr')
    await db.insert(categoryTranslations).values({
      id,
      categoryId,
      locale,
      name: input.name ?? null,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    })
    return this.findOne(event, categoryId, locale)
  },
}
