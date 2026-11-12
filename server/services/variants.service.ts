import { createError, type H3Event } from 'h3'
import { variantsRepository, type VariantInput } from '../repositories/variants.repository'

async function assertUniqueSku(event: H3Event, sku: string, ignoreId?: string) {
  const existing = await variantsRepository.findBySku(event, sku)
  if (existing && existing.id !== ignoreId) {
    throw createError({ statusCode: 409, statusMessage: `SKU "${sku}" is already in use` })
  }
}

export const variantsService = {
  async create(event: H3Event, productId: string, input: VariantInput) {
    await assertUniqueSku(event, input.sku)
    const id = await variantsRepository.create(event, productId, input)
    return variantsRepository.findById(event, id)
  },

  async update(event: H3Event, id: string, input: Partial<VariantInput>) {
    const existing = await variantsRepository.findById(event, id)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Variant not found' })
    if (input.sku) await assertUniqueSku(event, input.sku, id)
    await variantsRepository.update(event, id, input)
    return variantsRepository.findById(event, id)
  },

  async remove(event: H3Event, id: string) {
    const existing = await variantsRepository.findById(event, id)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Variant not found' })
    await variantsRepository.remove(event, id)
  },
}
