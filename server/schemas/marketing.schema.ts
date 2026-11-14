import { z } from 'zod'

export const marketingConfigUpdateSchema = z.object({
  metaAdAccountId: z.string().trim().min(1).max(64).nullable().optional(),
  tiktokAdvertiserId: z.string().trim().min(1).max(64).nullable().optional(),
})

export const socialPostGenerateSchema = z.object({
  productId: z.string().trim().min(1),
  platform: z.enum(['instagram', 'facebook', 'tiktok']),
  locale: z.enum(['fr', 'en', 'ar']),
  promptTypeId: z.string().trim().min(1),
  extraNotes: z.string().trim().max(300).optional(),
  referenceImageUrls: z.array(z.string().trim().min(1)).min(1, 'Pick at least one input image').max(3, 'Pick at most 3 input images'),
  imageInstructions: z.string().trim().max(300).optional(),
})
