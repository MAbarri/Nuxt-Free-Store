import { createError, type H3Event } from 'h3'
import { productsRepository, type ProductInput } from '../repositories/products.repository'
import { variantsRepository } from '../repositories/variants.repository'
import { productTranslationsRepository } from '../repositories/productTranslations.repository'
import { slugify, withUniqueSuffix } from '../utils/slug'
import { deleteImageFromR2, r2KeyFromUrl } from '../utils/media'
import { translateProductContent } from '../utils/openrouter'
import type { TranslatableLocale } from '../utils/locale'

async function uniqueSlug(event: H3Event, base: string, ignoreId?: string): Promise<string> {
  let candidate = slugify(base) || 'product'
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await productsRepository.findBySlug(event, candidate)
    if (!existing || existing.id === ignoreId) return candidate
    candidate = withUniqueSuffix(slugify(base) || 'product')
  }
  return candidate
}

async function assertUniqueSku(event: H3Event, sku: string, ignoreId?: string) {
  const existing = await productsRepository.findBySku(event, sku)
  if (existing && existing.id !== ignoreId) {
    throw createError({ statusCode: 409, statusMessage: `SKU "${sku}" is already in use` })
  }
}

export interface ProductWriteInput {
  name: string
  slug?: string
  description?: string | null
  shortDescription?: string | null
  sku: string
  basePrice: number
  compareAtPrice?: number | null
  status?: 'draft' | 'active' | 'archived'
  isFeatured?: boolean
  seoTitle?: string | null
  seoDescription?: string | null
  sizeGuideId?: string | null
  categoryIds?: string[]
  layoutStyle?: 'standard' | 'landing'
  landingBenefits?: Array<{ icon?: string, text: string }> | null
  landingBlocks?: Array<{ imageUrl: string, caption?: string }> | null
}

export const productsService = {
  list(event: H3Event, filters: Parameters<typeof productsRepository.list>[1]) {
    return productsRepository.list(event, filters)
  },

  async get(event: H3Event, id: string) {
    const product = await productsRepository.findById(event, id)
    if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })

    const [categoryIds, images, variants, translations] = await Promise.all([
      productsRepository.getCategoryIds(event, id),
      productsRepository.listImages(event, id),
      variantsRepository.listByProduct(event, id),
      productTranslationsRepository.mapByProduct(event, id),
    ])

    return { ...product, categoryIds, images, variants, translations }
  },

  async create(event: H3Event, input: ProductWriteInput) {
    await assertUniqueSku(event, input.sku)
    const slug = await uniqueSlug(event, input.slug || input.name)

    const product = await productsRepository.create(event, { ...input, slug } as ProductInput)
    if (!product) throw createError({ statusCode: 500, statusMessage: 'Failed to create product' })

    if (input.categoryIds) {
      await productsRepository.setCategories(event, product.id, input.categoryIds)
    }

    // Every product always has at least one variant so stock/inventory stays
    // uniformly variant-based (see spec: "Track inventory by product
    // variant"). Simple products just get one attribute-less "default"
    // variant, invisible as a variant picker in the storefront, which
    // variantsService transparently replaces once real attributed variants
    // are added.
    await variantsRepository.create(event, product.id, { sku: product.sku, stock: 0, isActive: true })

    return this.get(event, product.id)
  },

  async update(event: H3Event, id: string, input: Partial<ProductWriteInput>) {
    const existing = await this.get(event, id)

    if (input.sku) await assertUniqueSku(event, input.sku, id)

    let slug = existing.slug
    if (input.slug || input.name) {
      slug = await uniqueSlug(event, input.slug || input.name || existing.name, id)
    }

    const { categoryIds, ...fields } = input
    await productsRepository.update(event, id, { ...fields, slug } as Partial<ProductInput>)

    if (categoryIds) {
      await productsRepository.setCategories(event, id, categoryIds)
    }

    return this.get(event, id)
  },

  /** Duplicates a product (and its variants) as a new draft, for quick iteration on similar items. */
  async duplicate(event: H3Event, id: string) {
    const source = await this.get(event, id)

    const copy = await productsRepository.create(event, {
      name: `${source.name} (copy)`,
      slug: await uniqueSlug(event, `${source.name}-copy`),
      description: source.description,
      shortDescription: source.shortDescription,
      sku: `${source.sku}-COPY-${Date.now().toString(36).toUpperCase()}`,
      basePrice: source.basePrice,
      compareAtPrice: source.compareAtPrice,
      status: 'draft',
      isFeatured: false,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      sizeGuideId: source.sizeGuideId,
      layoutStyle: source.layoutStyle,
      landingBenefits: source.landingBenefits,
      landingBlocks: source.landingBlocks,
    })
    if (!copy) throw createError({ statusCode: 500, statusMessage: 'Failed to duplicate product' })

    await productsRepository.setCategories(event, copy.id, source.categoryIds)

    for (const variant of source.variants) {
      await variantsRepository.create(event, copy.id, {
        sku: `${variant.sku}-COPY-${Date.now().toString(36).toUpperCase()}`,
        price: variant.price,
        stock: 0,
        imageUrl: variant.imageUrl,
        isActive: variant.isActive,
        attributeValueIds: variant.attributes.map(a => a.valueId),
      })
    }

    return this.get(event, copy.id)
  },

  async archive(event: H3Event, id: string) {
    await this.get(event, id)
    await productsRepository.update(event, id, { status: 'archived' })
    return this.get(event, id)
  },

  async remove(event: H3Event, id: string) {
    const product = await this.get(event, id)
    for (const image of product.images) {
      const key = r2KeyFromUrl(image.url)
      if (key) await deleteImageFromR2(event, key)
    }
    await productsRepository.remove(event, id)
  },

  /** Manually saves/overrides one locale's translated fields (e.g. from the admin "Translations" tabs). */
  async upsertTranslation(event: H3Event, id: string, locale: TranslatableLocale, input: Parameters<typeof productTranslationsRepository.upsert>[3]) {
    await this.get(event, id)
    return productTranslationsRepository.upsert(event, id, locale, input)
  },

  /**
   * AI-translates this product's French content into the given locales
   * (both by default), overwriting any existing translation for each.
   * Used by the "Translate with AI" button on the product edit page, and by
   * bulk "Translate all" on the products list.
   */
  async aiTranslate(event: H3Event, id: string, locales: TranslatableLocale[] = ['en', 'ar']) {
    const product = await this.get(event, id)
    let cost = 0
    const translations: Partial<Record<TranslatableLocale, Awaited<ReturnType<typeof productTranslationsRepository.upsert>>>> = {}

    for (const locale of locales) {
      const { data, cost: callCost } = await translateProductContent(event, {
        targetLocale: locale,
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        landingBenefits: product.landingBenefits,
        landingBlocks: product.landingBlocks,
      })
      cost += callCost
      translations[locale] = await productTranslationsRepository.upsert(event, id, locale, data)
    }

    return { translations, cost }
  },
}
