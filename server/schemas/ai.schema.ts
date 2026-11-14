import { z } from 'zod'

const dataUrlSchema = z.string().trim().regex(/^data:image\/(png|jpe?g|webp);base64,/, 'Expected a base64 image data URL')

export const aiProductCopySchema = z.object({
  imageDataUrl: dataUrlSchema,
  colors: z.array(z.string().trim().min(1)).max(20).default([]),
  sizes: z.array(z.string().trim().min(1)).max(20).default([]),
  price: z.number().int().nonnegative(),
  categoryName: z.string().trim().optional(),
})

export const aiProductImagesSchema = z.object({
  imageDataUrl: dataUrlSchema,
  sceneIds: z.array(z.string().trim().min(1)).min(1).max(20),
  color: z.string().trim().min(1).max(60).optional(),
  stylingNotes: z.string().trim().min(1).max(200).optional(),
})

export const aiLandingBlocksSchema = z.object({
  imageDataUrl: dataUrlSchema,
  productName: z.string().trim().min(1),
  sceneIds: z.array(z.string().trim().min(1)).max(3).optional(),
  count: z.number().int().min(1).max(3).optional(),
})

export const aiTranslateLandingBlocksSchema = z.object({
  captions: z.array(z.string().trim().nullable()).min(1).max(3),
})

export const aiConfigUpdateSchema = z.object({
  textModel: z.string().trim().min(1).max(120).optional(),
  imageModel: z.string().trim().min(1).max(120).optional(),
  logoWatermarkEnabled: z.boolean().optional(),
})

const aiLandingBenefitSchema = z.object({
  icon: z.string().trim().max(8).optional(),
  text: z.string().trim().min(1),
})

const aiLocaleContentSchema = z.object({
  name: z.string().trim().optional().nullable(),
  shortDescription: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  seoTitle: z.string().trim().optional().nullable(),
  seoDescription: z.string().trim().optional().nullable(),
  landingBenefits: z.array(aiLandingBenefitSchema).max(6).optional().nullable(),
  landingBlockCaptions: z.array(z.string().trim().nullable()).max(3).optional().nullable(),
})

const aiVariantInputSchema = z.object({
  sku: z.string().trim().min(1),
  stock: z.number().int().nonnegative(),
  attributeValueIds: z.array(z.string().trim()).default([]),
})

export const aiProductCreateSchema = z.object({
  sku: z.string().trim().min(1),
  basePrice: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().optional().nullable(),
  categoryIds: z.array(z.string().trim()).default([]),
  referenceImageDataUrl: dataUrlSchema,
  includeReferenceImage: z.boolean().default(true),
  generatedImageDataUrls: z.array(dataUrlSchema).max(20).default([]),
  layoutStyle: z.enum(['standard', 'landing']).default('landing'),
  landingBenefits: z.array(aiLandingBenefitSchema).max(6).optional().nullable(),
  landingBlocks: z.array(z.object({
    imageDataUrl: dataUrlSchema,
    caption: z.string().trim().max(200).optional(),
  })).max(3).optional().default([]),
  translations: z.object({
    fr: aiLocaleContentSchema.extend({ name: z.string().trim().min(1) }),
    en: aiLocaleContentSchema.optional(),
    ar: aiLocaleContentSchema.optional(),
  }),
  variants: z.array(aiVariantInputSchema).min(1),
})
