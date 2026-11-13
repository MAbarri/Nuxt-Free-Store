import { z } from 'zod'

const landingBenefitSchema = z.object({
  icon: z.string().trim().max(8).optional().nullable(),
  text: z.string().trim().min(1).max(160),
})

export const productTranslationWriteSchema = z.object({
  name: z.string().trim().min(1).optional().nullable(),
  shortDescription: z.string().trim().max(280).optional().nullable(),
  description: z.string().trim().optional().nullable(),
  seoTitle: z.string().trim().max(160).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
  landingBenefits: z.array(landingBenefitSchema).max(6).optional().nullable(),
  landingBlockCaptions: z.array(z.string().trim().max(240).nullable()).max(3).optional().nullable(),
})

export const categoryTranslationWriteSchema = z.object({
  name: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().optional().nullable(),
})

export const aiTranslateSchema = z.object({
  locales: z.array(z.enum(['en', 'ar'])).min(1).max(2).optional(),
})

const settingsHeroTranslationSchema = z.object({
  title: z.string().trim().optional().nullable(),
  subtitle: z.string().trim().optional().nullable(),
  ctaLabel: z.string().trim().optional().nullable(),
})

const settingsPromoTranslationSchema = z.object({
  title: z.string().trim().optional().nullable(),
  subtitle: z.string().trim().optional().nullable(),
})

export const settingsTranslationWriteSchema = z.object({
  tagline: z.string().trim().optional().nullable(),
  announcementBar: z.string().trim().optional().nullable(),
  hero: settingsHeroTranslationSchema.optional().nullable(),
  promo: settingsPromoTranslationSchema.optional().nullable(),
  trustBadges: z.array(z.object({ label: z.string().trim().nullable() })).max(6).optional().nullable(),
})
