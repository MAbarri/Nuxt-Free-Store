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
  sceneIds: z.array(z.string().trim().min(1)).min(1).max(6),
  color: z.string().trim().min(1).max(60).optional(),
  stylingNotes: z.string().trim().min(1).max(200).optional(),
})

const aiLocaleContentSchema = z.object({
  name: z.string().trim().optional().nullable(),
  shortDescription: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  seoTitle: z.string().trim().optional().nullable(),
  seoDescription: z.string().trim().optional().nullable(),
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
  generatedImageDataUrls: z.array(dataUrlSchema).max(4).default([]),
  translations: z.object({
    fr: aiLocaleContentSchema.extend({ name: z.string().trim().min(1) }),
    en: aiLocaleContentSchema.optional(),
    ar: aiLocaleContentSchema.optional(),
  }),
  variants: z.array(aiVariantInputSchema).min(1),
})
