import { createError, type H3Event } from 'h3'
import { productUpsellsRepository } from '../repositories/productUpsells.repository'
import { productsRepository } from '../repositories/products.repository'
import { variantsRepository } from '../repositories/variants.repository'
import { pickDefaultVariant } from '../utils/variants'

export const productUpsellsService = {
  async listForAdmin(event: H3Event, productId: string) {
    await assertProductExists(event, productId)
    return productUpsellsRepository.listForAdmin(event, productId)
  },

  async add(event: H3Event, productId: string, relatedProductId: string) {
    if (productId === relatedProductId) {
      throw createError({ statusCode: 422, statusMessage: 'A product cannot be a companion of itself' })
    }
    await assertProductExists(event, productId)
    await assertProductExists(event, relatedProductId)

    const already = await productUpsellsRepository.exists(event, productId, relatedProductId)
    if (already) throw createError({ statusCode: 409, statusMessage: 'This product is already added as a companion' })

    await productUpsellsRepository.add(event, productId, relatedProductId)
    return this.listForAdmin(event, productId)
  },

  async remove(event: H3Event, productId: string, upsellId: string) {
    const row = await productUpsellsRepository.findById(event, upsellId)
    if (!row || row.productId !== productId) throw createError({ statusCode: 404, statusMessage: 'Companion not found' })
    await productUpsellsRepository.remove(event, upsellId)
    return this.listForAdmin(event, productId)
  },

  /** Swaps this row's position with its immediate neighbor in the given direction. */
  async move(event: H3Event, productId: string, upsellId: string, direction: 'up' | 'down') {
    const rows = await productUpsellsRepository.listForProduct(event, productId)
    const index = rows.findIndex(r => r.id === upsellId)
    if (index === -1) throw createError({ statusCode: 404, statusMessage: 'Companion not found' })

    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (swapWith < 0 || swapWith >= rows.length) return this.listForAdmin(event, productId)

    const a = rows[index]!
    const b = rows[swapWith]!
    await productUpsellsRepository.setPosition(event, a.id, b.position)
    await productUpsellsRepository.setPosition(event, b.id, a.position)
    return this.listForAdmin(event, productId)
  },

  /** Storefront exposure: active companions with a resolved default variant/price/stock, for the "frequently bought together" section and the Landing page's companion add-on. */
  async listForStorefront(event: H3Event, productId: string) {
    const rows = await productUpsellsRepository.listForStorefront(event, productId)
    if (!rows.length) return []

    const withVariants = await Promise.all(rows.map(async (row) => {
      const variants = await variantsRepository.listByProduct(event, row.id)
      const defaultVariant = pickDefaultVariant(variants)
      const price = defaultVariant?.price ?? row.basePrice
      const inStock = !!defaultVariant && defaultVariant.isActive && defaultVariant.stock > 0
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        imageUrl: row.imageUrl,
        price,
        compareAtPrice: row.compareAtPrice,
        inStock,
        defaultVariantId: defaultVariant?.id ?? null,
      }
    }))

    return withVariants
  },
}

async function assertProductExists(event: H3Event, productId: string) {
  const product = await productsRepository.findById(event, productId)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  return product
}
