import { createError, type H3Event } from 'h3'
import { productsRepository, type ProductInput } from '../repositories/products.repository'
import { variantsRepository } from '../repositories/variants.repository'
import { slugify, withUniqueSuffix } from '../utils/slug'
import { deleteImageFromR2, r2KeyFromUrl } from '../utils/media'

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
}

export const productsService = {
  list(event: H3Event, filters: Parameters<typeof productsRepository.list>[1]) {
    return productsRepository.list(event, filters)
  },

  async get(event: H3Event, id: string) {
    const product = await productsRepository.findById(event, id)
    if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })

    const [categoryIds, images, variants] = await Promise.all([
      productsRepository.getCategoryIds(event, id),
      productsRepository.listImages(event, id),
      variantsRepository.listByProduct(event, id),
    ])

    return { ...product, categoryIds, images, variants }
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
}
