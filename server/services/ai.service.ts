import { createError, type H3Event } from 'h3'
import {
  generateProductCopyFromImage,
  generateProductImage,
  translateProductContent,
  generateLandingBenefits,
  generateLifestyleCaption,
  translateLandingBlockCaptions,
} from '../utils/openrouter'
import { productsService } from './products.service'
import { productsRepository } from '../repositories/products.repository'
import { productTranslationsRepository } from '../repositories/productTranslations.repository'
import { variantsRepository } from '../repositories/variants.repository'
import { uploadImageToR2, dataUrlToBytes } from '../utils/media'
import type { TranslatableLocale } from '../utils/locale'

function colorClause(color?: string): string {
  return color
    ? ` Change the garment's color to ${color}; keep its exact cut, silhouette, fabric texture and design otherwise identical to the reference image.`
    : ' Keep the garment\'s color, pattern and design identical to the reference image.'
}

function stylingClause(hasModel: boolean, stylingNotes?: string): string {
  return hasModel && stylingNotes ? ` Additional model styling: ${stylingNotes}.` : ''
}

export interface ImageScene {
  id: string
  label: string
  /** Whether this scene features a model wearing the garment (vs. a detail-only shot) — styling notes only apply here. */
  hasModel: boolean
  buildPrompt: (opts: { color?: string, stylingNotes?: string }) => string
}

// A selectable library of shot "scenes", each a distinct prompt template.
// Every prompt repeats "exact same garment... keep color/pattern/design
// identical" (via colorClause) — that's what keeps a generated carousel
// looking like the same product across angles/settings, not a lookalike.
export const IMAGE_SCENES: ImageScene[] = [
  {
    id: 'studio-front',
    label: 'Studio — Front view',
    hasModel: true,
    buildPrompt: ({ color, stylingNotes }) =>
      `Professional e-commerce product photo of the exact same garment shown in the reference image, front view, worn by a model, soft studio lighting, clean neutral background, editorial fashion catalog style.${colorClause(color)}${stylingClause(true, stylingNotes)}`,
  },
  {
    id: 'studio-back',
    label: 'Studio — Back view',
    hasModel: true,
    buildPrompt: ({ color, stylingNotes }) =>
      `Professional e-commerce product photo of the exact same garment shown in the reference image, back view, worn by a model, soft studio lighting, clean neutral background, editorial fashion catalog style.${colorClause(color)}${stylingClause(true, stylingNotes)}`,
  },
  {
    id: 'studio-detail',
    label: 'Studio — Detail close-up',
    hasModel: false,
    buildPrompt: ({ color }) =>
      `Close-up detail product photo of the exact same garment shown in the reference image, focused on fabric texture and stitching, soft studio lighting, shallow depth of field, no model.${colorClause(color)}`,
  },
  {
    id: 'lifestyle-casablanca-street',
    label: 'Lifestyle — Casablanca street',
    hasModel: true,
    buildPrompt: ({ color, stylingNotes }) =>
      `Candid editorial street-style photo of a model wearing the exact same garment shown in the reference image, walking on a lively Casablanca street, Art Deco facades and tiled sidewalks in the background, palm trees, warm natural daylight, fashion-blog photography style.${colorClause(color)}${stylingClause(true, stylingNotes)}`,
  },
  {
    id: 'lifestyle-casablanca-cafe',
    label: 'Lifestyle — Casablanca café',
    hasModel: true,
    buildPrompt: ({ color, stylingNotes }) =>
      `Candid editorial lifestyle photo of a model wearing the exact same garment shown in the reference image, seated at a Moroccan café terrace, brass table, a glass of mint tea nearby, mosaic tile details, warm natural light, relaxed and elegant mood.${colorClause(color)}${stylingClause(true, stylingNotes)}`,
  },
]

export function getImageScene(id: string): ImageScene {
  const scene = IMAGE_SCENES.find(s => s.id === id)
  if (!scene) throw createError({ statusCode: 422, statusMessage: `Unknown image scene: ${id}` })
  return scene
}

export interface WizardLocaleContent {
  name: string
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  landingBenefits?: Array<{ icon?: string, text: string }> | null
  landingBlockCaptions?: Array<string | null> | null
}

const DEFAULT_LANDING_BLOCK_SCENES = ['lifestyle-casablanca-street', 'lifestyle-casablanca-cafe']

export const aiService = {
  /**
   * Analyzes the reference photo and writes French product copy (including
   * landing-page benefit bullets), then immediately translates it into
   * English and Arabic — so the wizard's review step opens with all three
   * language tabs already populated.
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

    const { data: benefitsData, cost: benefitsCost } = await generateLandingBenefits(event, {
      name: fr.name,
      shortDescription: fr.shortDescription,
      description: fr.description,
    })
    cost += benefitsCost

    const translations: Partial<Record<TranslatableLocale, WizardLocaleContent>> = {}
    for (const locale of ['en', 'ar'] as const) {
      const { data, cost: tCost } = await translateProductContent(event, {
        targetLocale: locale,
        name: fr.name,
        shortDescription: fr.shortDescription,
        description: fr.description,
        seoTitle: fr.seoTitle,
        seoDescription: fr.seoDescription,
        landingBenefits: benefitsData.benefits,
        landingBlocks: null,
      })
      cost += tCost
      translations[locale] = data
    }

    return {
      fr: { ...fr, landingBenefits: benefitsData.benefits },
      en: translations.en ?? null,
      ar: translations.ar ?? null,
      cost,
    }
  },

  /** Generates photos for the given scene ids (see IMAGE_SCENES), optionally recoloring the garment and/or adding model styling notes. Pass a single scene id to regenerate just that one shot. */
  async generateImages(event: H3Event, input: { imageDataUrl: string, sceneIds: string[], color?: string, stylingNotes?: string }) {
    const images: Array<{ dataUrl: string, sceneId: string }> = []
    let cost = 0
    for (const sceneId of input.sceneIds) {
      const scene = getImageScene(sceneId)
      const prompt = scene.buildPrompt({ color: input.color, stylingNotes: input.stylingNotes })
      const { data, cost: imgCost } = await generateProductImage(event, { referenceImageDataUrl: input.imageDataUrl, prompt })
      images.push({ dataUrl: data.dataUrl, sceneId })
      cost += imgCost
    }
    return { images, cost }
  },

  /** Generates lifestyle photo blocks (image + AI-written French caption) for a Landing-style page, defaulting to the two Casablanca scenes. Not persisted — for review before saving. */
  async generateLandingBlocks(event: H3Event, input: { imageDataUrl: string, productName: string, sceneIds?: string[] }) {
    const sceneIds = input.sceneIds?.length ? input.sceneIds : DEFAULT_LANDING_BLOCK_SCENES
    const blocks: Array<{ dataUrl: string, caption: string, sceneId: string }> = []
    let cost = 0
    for (const sceneId of sceneIds) {
      const scene = getImageScene(sceneId)
      const { data: img, cost: imgCost } = await generateProductImage(event, { referenceImageDataUrl: input.imageDataUrl, prompt: scene.buildPrompt({}) })
      cost += imgCost
      const { data: cap, cost: capCost } = await generateLifestyleCaption(event, { imageDataUrl: img.dataUrl, productName: input.productName })
      cost += capCost
      blocks.push({ dataUrl: img.dataUrl, caption: cap.caption, sceneId })
    }
    return { blocks, cost }
  },

  /** Translates a list of lifestyle-block captions (aligned by index) into English and Arabic. */
  async translateLandingBlocks(event: H3Event, captions: Array<string | null>) {
    let cost = 0
    const translations: Record<'en' | 'ar', Array<string | null>> = { en: [], ar: [] }
    for (const locale of ['en', 'ar'] as const) {
      const { data, cost: c } = await translateLandingBlockCaptions(event, { targetLocale: locale, captions })
      cost += c
      translations[locale] = data.captions
    }
    return { translations, cost }
  },

  /** Persists the reviewed wizard output as a real product: variants, images, landing content, and translations in one go. */
  async createProduct(event: H3Event, input: {
    sku: string
    basePrice: number
    compareAtPrice?: number | null
    categoryIds: string[]
    referenceImageDataUrl: string
    includeReferenceImage: boolean
    generatedImageDataUrls: string[]
    layoutStyle?: 'standard' | 'landing'
    landingBenefits?: Array<{ icon?: string, text: string }> | null
    landingBlocks?: Array<{ imageDataUrl: string, caption?: string }>
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
      layoutStyle: input.layoutStyle ?? 'landing',
      landingBenefits: input.landingBenefits ?? null,
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
        landingBenefits: content.landingBenefits ?? null,
        landingBlockCaptions: content.landingBlockCaptions ?? null,
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

    if (input.landingBlocks?.length) {
      await productsService.addGeneratedLandingBlocks(
        event,
        product.id,
        input.landingBlocks.map(b => ({ imageDataUrl: b.imageDataUrl, caption: b.caption ?? '' })),
      )
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
