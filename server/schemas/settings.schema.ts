import { z } from 'zod'

const heroSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1).nullable(),
  ctaLabel: z.string().trim().min(1),
  ctaHref: z.string().trim().min(1),
})

const promoSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().min(1),
})

const trustBadgeSchema = z.object({
  icon: z.string().trim().max(8).optional(),
  label: z.string().trim().min(1),
})

export const settingsUpdateSchema = z.object({
  storeName: z.string().trim().min(1).optional(),
  tagline: z.string().trim().min(1).optional(),
  logoUrl: z.string().trim().min(1).nullable().optional(),
  accentColor: z.string().trim().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Must be a hex color like #bb6540').optional(),
  defaultShippingFee: z.number().int().nonnegative().optional(),
  hero: heroSchema.optional(),
  promo: promoSchema.optional(),
  trustBadges: z.array(trustBadgeSchema).max(6).optional(),
  announcementBar: z.string().trim().max(200).nullable().optional(),
})
