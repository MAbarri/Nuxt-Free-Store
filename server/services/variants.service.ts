import { createError, type H3Event } from 'h3'
import { variantsRepository, type VariantInput } from '../repositories/variants.repository'
import { productsRepository } from '../repositories/products.repository'
import { slugify } from '../utils/slug'

async function assertUniqueSku(event: H3Event, sku: string, ignoreId?: string) {
  const existing = await variantsRepository.findBySku(event, sku)
  if (existing && existing.id !== ignoreId) {
    throw createError({ statusCode: 409, statusMessage: `SKU "${sku}" is already in use` })
  }
}

function comboKey(attributeValueIds: string[]) {
  return [...attributeValueIds].sort().join('|')
}

/** Turns an attribute value like "Rouge Bordeaux" into a short SKU segment like "ROUGEBORDEAUX". */
function skuPart(value: string): string {
  return slugify(value).replace(/-/g, '').toUpperCase().slice(0, 12)
}

export interface VariantComboInput {
  attributeValueIds: string[]
  sku?: string
  price?: number | null
  stock?: number
  isActive?: boolean
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

  /**
   * Creates every requested attribute combination in one go (the admin
   * "generate variants" flow), instead of one combination per request.
   * Combinations that already exist are skipped rather than failing the
   * whole batch; combinations whose (possibly auto-generated) SKU collides
   * with another product's variant are reported back individually too.
   */
  async createBulk(event: H3Event, productId: string, combos: VariantComboInput[]) {
    const product = await productsRepository.findById(event, productId)
    if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })

    let siblings = await variantsRepository.listByProduct(event, productId)
    // Mirror single-variant create(): a lone attribute-less "default"
    // variant (seeded for simple products) is replaced outright the moment
    // any real, attributed variant is being added.
    const defaultVariant = siblings.find(v => v.attributes.length === 0)
    if (defaultVariant && siblings.length === 1 && combos.length) {
      await variantsRepository.remove(event, defaultVariant.id)
      siblings = []
    }

    const seenKeys = new Set(siblings.map(v => comboKey(v.attributes.map(a => a.valueId))))
    const created: NonNullable<Awaited<ReturnType<typeof variantsRepository.findById>>>[] = []
    const skipped: Array<{ attributeValueIds: string[], reason: string }> = []
    const failed: Array<{ attributeValueIds: string[], sku: string, reason: string }> = []

    for (const combo of combos) {
      const key = comboKey(combo.attributeValueIds)
      if (seenKeys.has(key)) {
        skipped.push({ attributeValueIds: combo.attributeValueIds, reason: 'A variant with this exact combination already exists' })
        continue
      }

      let sku = combo.sku?.trim()
      if (!sku) {
        const values = await variantsRepository.findValuesByIds(event, combo.attributeValueIds)
        const parts = combo.attributeValueIds
          .map(id => values.find(v => v.id === id)?.value)
          .filter((v): v is string => !!v)
          .map(skuPart)
        sku = [product.sku, ...parts].filter(Boolean).join('-')
      }

      try {
        await assertUniqueSku(event, sku)
      }
      catch (e) {
        failed.push({ attributeValueIds: combo.attributeValueIds, sku, reason: e instanceof Error ? e.message : 'SKU already in use' })
        continue
      }

      const id = await variantsRepository.create(event, productId, {
        sku,
        price: combo.price ?? null,
        stock: combo.stock ?? 0,
        isActive: combo.isActive ?? true,
        attributeValueIds: combo.attributeValueIds,
      })
      seenKeys.add(key)
      const row = await variantsRepository.findById(event, id)
      if (row) created.push(row)
    }

    return { created, skipped, failed }
  },
}
