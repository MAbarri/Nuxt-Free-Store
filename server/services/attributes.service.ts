import { createError, type H3Event } from 'h3'
import { attributesRepository } from '../repositories/attributes.repository'
import { slugify } from '../utils/slug'

export const attributesService = {
  list(event: H3Event) {
    return attributesRepository.list(event)
  },

  async create(event: H3Event, input: { name: string, displayType: 'text' | 'select' | 'swatch' }) {
    const slug = slugify(input.name)
    const existing = await attributesRepository.findBySlug(event, slug)
    if (existing) {
      throw createError({ statusCode: 409, statusMessage: `Attribute "${input.name}" already exists` })
    }
    return attributesRepository.create(event, { name: input.name, slug, displayType: input.displayType })
  },

  remove(event: H3Event, id: string) {
    return attributesRepository.remove(event, id)
  },

  addValue(event: H3Event, attributeId: string, input: { value: string, swatchHex?: string | null, swatchImageUrl?: string | null, sortOrder?: number }) {
    return attributesRepository.addValue(event, attributeId, input)
  },

  removeValue(event: H3Event, valueId: string) {
    return attributesRepository.removeValue(event, valueId)
  },
}
