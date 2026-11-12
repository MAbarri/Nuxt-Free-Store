import { createError, type H3Event } from 'h3'
import { variantsRepository, type VariantInput } from '../repositories/variants.repository'
import { productsRepository } from '../repositories/products.repository'

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

    // Adding a real (attributed) variant replaces the auto-created
    // attribute-less "default" variant used for simple products, so a
    // product never ends up with both a default and real variants at once.
    if (input.attributeValueIds?.length) {
      const siblings = await variantsRepository.listByProduct(event, productId)
      const defaultVariant = siblings.find(v => v.id !== id && v.attributes.length === 0)
      if (defaultVariant && siblings.length === 2) {
        await variantsRepository.remove(event, defaultVariant.id)
      }
    }

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

    // Never leave a product with zero variants — fall back to a fresh
    // default variant so it stays orderable as a simple product.
    const remaining = await variantsRepository.listByProduct(event, existing.productId)
    if (!remaining.length) {
      const product = await productsRepository.findById(event, existing.productId)
      if (product) {
        await variantsRepository.create(event, existing.productId, { sku: product.sku, stock: 0, isActive: true })
      }
    }
  },
}
