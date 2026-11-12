import { createError, type H3Event } from 'h3'
import { categoriesRepository, type CategoryInput } from '../repositories/categories.repository'
import { slugify, withUniqueSuffix } from '../utils/slug'

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
    return category
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
}
