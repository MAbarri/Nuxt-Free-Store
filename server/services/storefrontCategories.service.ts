import { and, asc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { categories } from '../database/schema'
import { useDb } from '../utils/db'
import { categoryTranslationsRepository } from '../repositories/categoryTranslations.repository'
import { applyCategoryTranslation, resolveLocaleFromEvent } from '../utils/locale'

export const storefrontCategoriesService = {
  async list(event: H3Event) {
    const db = useDb(event)
    const locale = resolveLocaleFromEvent(event)
    const rows = await db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name))

    if (locale === 'fr' || !rows.length) return rows

    const translations = await categoryTranslationsRepository.listByCategories(event, rows.map(r => r.id))
    const map = new Map(translations.filter(t => t.locale === locale).map(t => [t.categoryId, t]))
    return rows.map(row => applyCategoryTranslation(row, map.get(row.id), locale))
  },

  async getBySlug(event: H3Event, slug: string) {
    const db = useDb(event)
    const locale = resolveLocaleFromEvent(event)
    const [row] = await db.select().from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
      .limit(1)
    if (!row) return null

    if (locale === 'fr') return row
    const translation = await categoryTranslationsRepository.findOne(event, row.id, locale)
    return applyCategoryTranslation(row, translation, locale)
  },
}
