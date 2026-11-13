import { createError, type H3Event } from 'h3'
import { categoriesRepository, type CategoryInput } from '../repositories/categories.repository'
import { categoryTranslationsRepository } from '../repositories/categoryTranslations.repository'
import { slugify, withUniqueSuffix } from '../utils/slug'
import { translateCategoryContent } from '../utils/openrouter'
import type { TranslatableLocale } from '../utils/locale'

async function uniqueSlug(event: H3Event, base: string, ignoreId?: string): Promise<string> {
  let candidate = slugify(base) || 'category'
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await categoriesRepository.findBySlug(event, candidate)
    if (!existing || existing.id === ignoreId) return candidate
    candidate = withUniqueSuffix(slugify(base) || 'category')
  }
  return candidate
}

export interface CategoryWriteInput {
  name: string
  slug?: string
  description?: string | null
  imageUrl?: string | null
  parentId?: string | null
  isActive?: boolean
  sortOrder?: number
}

export const categoriesService = {
  list(event: H3Event) {
    return categoriesRepository.list(event)
  },

  async get(event: H3Event, id: string) {
    const category = await categoriesRepository.findById(event, id)
    if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found' })
    const translations = await categoryTranslationsRepository.mapByCategory(event, id)
    return { ...category, translations }
  },

  async create(event: H3Event, input: CategoryWriteInput) {
    if (input.parentId) await this.get(event, input.parentId)
    const slug = await uniqueSlug(event, input.slug || input.name)
    return categoriesRepository.create(event, { ...input, slug })
  },

  async update(event: H3Event, id: string, input: Partial<CategoryWriteInput>) {
    const existing = await this.get(event, id)

    if (input.parentId === id) {
      throw createError({ statusCode: 422, statusMessage: 'A category cannot be its own parent' })
    }
    if (input.parentId) await this.get(event, input.parentId)

    let slug = existing.slug
    if (input.slug || input.name) {
      slug = await uniqueSlug(event, input.slug || input.name || existing.name, id)
    }

    return categoriesRepository.update(event, id, { ...input, slug } as Partial<CategoryInput>)
  },

  async remove(event: H3Event, id: string) {
    await this.get(event, id)
    await categoriesRepository.remove(event, id)
  },

  async upsertTranslation(event: H3Event, id: string, locale: TranslatableLocale, input: Parameters<typeof categoryTranslationsRepository.upsert>[3]) {
    await this.get(event, id)
    return categoryTranslationsRepository.upsert(event, id, locale, input)
  },

  async aiTranslate(event: H3Event, id: string, locales: TranslatableLocale[] = ['en', 'ar']) {
    const category = await this.get(event, id)
    let cost = 0
    const translations: Partial<Record<TranslatableLocale, Awaited<ReturnType<typeof categoryTranslationsRepository.upsert>>>> = {}

    for (const locale of locales) {
      const { data, cost: callCost } = await translateCategoryContent(event, {
        targetLocale: locale,
        name: category.name,
        description: category.description,
      })
      cost += callCost
      translations[locale] = await categoryTranslationsRepository.upsert(event, id, locale, data)
    }

    return { translations, cost }
  },
}
