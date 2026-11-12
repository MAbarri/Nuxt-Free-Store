import { createError, type H3Event } from 'h3'
import { sizeGuidesRepository, type SizeGuideInput } from '../repositories/sizeGuides.repository'

export const sizeGuidesService = {
  list(event: H3Event) {
    return sizeGuidesRepository.list(event)
  },

  async get(event: H3Event, id: string) {
    const guide = await sizeGuidesRepository.findById(event, id)
    if (!guide) throw createError({ statusCode: 404, statusMessage: 'Size guide not found' })
    return guide
  },

  async create(event: H3Event, input: SizeGuideInput) {
    const id = await sizeGuidesRepository.create(event, input)
    return this.get(event, id)
  },

  async update(event: H3Event, id: string, input: Partial<SizeGuideInput>) {
    await this.get(event, id)
    await sizeGuidesRepository.update(event, id, input)
    return this.get(event, id)
  },

  async remove(event: H3Event, id: string) {
    await this.get(event, id)
    await sizeGuidesRepository.remove(event, id)
  },
}
