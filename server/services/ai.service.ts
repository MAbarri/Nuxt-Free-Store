import { createError, type H3Event } from 'h3'
import { generateProductCopyFromImage, generateProductImage, translateProductContent } from '../utils/openrouter'
import { productsService } from './products.service'
import { productsRepository } from '../repositories/products.repository'
import { productTranslationsRepository } from '../repositories/productTranslations.repository'
import { variantsRepository } from '../repositories/variants.repository'
import { uploadImageToR2 } from '../utils/media'
import type { TranslatableLocale } from '../utils/locale'

function dataUrlToBytes(dataUrl: string): { data: Uint8Array, contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw createError({ statusCode: 422, statusMessage: 'Invalid image data URL' })
  const [, contentType, base64] = match
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { data: bytes, contentType }
}

// One prompt per carousel shot, each instructed to preserve the reference
// photo's garment exactly and only vary angle/setting — this is what keeps
// the generated carousel looking like "the same product", not a lookalike.
const IMAGE_SHOT_PROMPTS = [
  'Professional e-commerce product photo of the exact same garment shown in the reference image, front view, worn by a model, soft studio lighting, clean neutral background, editorial fashion catalog style. Keep the garment\'s color, pattern and design identical to the reference image.',
  'Professional e-commerce product photo of the exact same garment shown in the reference image, back view, worn by a model, soft studio lighting, clean neutral background, editorial fashion catalog style. Keep the garment\'s color, pattern and design identical to the reference image.',
  'Close-up detail product photo of the exact same garment shown in the reference image, focused on fabric texture and stitching, soft studio lighting, shallow depth of field, no model. Keep the garment\'s color, pattern and design identical to the reference image.',
  'Lifestyle photo of a model wearing the exact same garment shown in the reference image, outdoors in natural daylight, candid editorial fashion photography style. Keep the garment\'s color, pattern and design identical to the reference image.',
]

export interface WizardLocaleContent {
  name: string
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
}

export const aiService = {
  /**
   * Analyzes the reference photo and writes French product copy, then
   * immediately translates it into English and Arabic — so the wizard's
   * review step opens with all three language tabs already populated.
   */
  async generateCopy(event: H3Event, input: { imageDataUrl: string, colors: string[], sizes: string[], price: number, categoryName?: string }) {
    const priceLabel = `${(input.price / 100).toFixed(2)} DH`
    const { data: fr, cost: copyCost } = await generateProductCopyFromImage(event, {
      imageDataUrl: input.imageDataUrl,
      colors: input.colors,
      sizes: input.sizes,
      priceLabel,
      categoryName: input.categoryName,
    })

    let cost = copyCost
    const translations: Partial<Record<TranslatableLocale, WizardLocaleContent>> = {}
    for (const locale of ['en', 'ar'] as const) {
      const { data, cost: tCost } = await translateProductContent(event, {
        targetLocale: locale,
        name: fr.name,
        shortDescription: fr.shortDescription,
        description: fr.description,
        seoTitle: fr.seoTitle,
        seoDescription: fr.seoDescription,
        landingBenefits: null,
        landingBlocks: null,
      })
      cost += tCost
      translations[locale] = data
    }

    return { fr, en: translations.en ?? null, ar: translations.ar ?? null, cost }
  },

  /** Generates carousel shots consistent with the reference photo. Pass `shotIndex` to regenerate just one specific shot. */
  async generateImages(event: H3Event, input: { imageDataUrl: string, count: number, shotIndex?: number }) {
    const prompts = input.shotIndex !== undefined
      ? [IMAGE_SHOT_PROMPTS[input.shotIndex]]
      : IMAGE_SHOT_PROMPTS.slice(0, input.count)
    const images: Array<{ dataUrl: string }> = []
    let cost = 0
    for (const prompt of prompts) {
      const { data, cost: imgCost } = await generateProductImage(event, { referenceImageDataUrl: input.imageDataUrl, prompt })
      images.push({ dataUrl: data.dataUrl })
      cost += imgCost
    }
    return { images, cost }
  },

  /** Persists the reviewed wizard output as a real product: variants, images, and translations in one go. */
  async createProduct(event: H3Event, input: {
    sku: string
    basePrice: number
    compareAtPrice?: number | null
    categoryIds: string[]
    referenceImageDataUrl: string
    includeReferenceImage: boolean
    generatedImageDataUrls: string[]
    translations: { fr: WizardLocaleContent, en?: WizardLocaleContent | null, ar?: WizardLocaleContent | null }
    variants: Array<{ sku: string, stock: number, attributeValueIds: string[] }>
  }) {
    const product = await productsService.create(event, {
      name: input.translations.fr.name,
      shortDescription: input.translations.fr.shortDescription ?? null,
      description: input.translations.fr.description ?? null,
      sku: input.sku,
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice ?? null,
      status: 'draft',
      seoTitle: input.translations.fr.seoTitle ?? null,
      seoDescription: input.translations.fr.seoDescription ?? null,
      categoryIds: input.categoryIds,
    })

    for (const locale of ['en', 'ar'] as const) {
      const content = input.translations[locale]
      if (!content) continue
      await productTranslationsRepository.upsert(event, product.id, locale, {
        name: content.name ?? null,
        shortDescription: content.shortDescription ?? null,
        description: content.description ?? null,
        seoTitle: content.seoTitle ?? null,
        seoDescription: content.seoDescription ?? null,
      })
    }

    const imageDataUrls = [
      ...(input.includeReferenceImage ? [input.referenceImageDataUrl] : []),
      ...input.generatedImageDataUrls,
    ]
    for (const dataUrl of imageDataUrls) {
      const { data, contentType } = dataUrlToBytes(dataUrl)
      const { url } = await uploadImageToR2(event, { data, contentType, folder: `products/${product.id}` })
      const existing = await productsRepository.listImages(event, product.id)
      await productsRepository.addImage(event, product.id, { url, sortOrder: existing.length })
    }

    // `productsService.create` always seeds one attribute-less "default"
    // variant (see its comment) — replace it outright with the wizard's real
    // color×size variants rather than risk a SKU collision alongside it.
    const seeded = await variantsRepository.listByProduct(event, product.id)
    for (const variant of seeded) await variantsRepository.remove(event, variant.id)

    for (const variant of input.variants) {
      await variantsRepository.create(event, product.id, {
        sku: variant.sku,
        stock: variant.stock,
        isActive: true,
        attributeValueIds: variant.attributeValueIds,
      })
    }

    return productsService.get(event, product.id)
  },
}
