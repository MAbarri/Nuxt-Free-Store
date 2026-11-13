import { z } from 'zod'

const landingBenefitSchema = z.object({
  icon: z.string().trim().max(8).optional(),
  text: z.string().trim().min(1).max(160),
})

const landingBlockSchema = z.object({
  imageUrl: z.string().trim().min(1),
  caption: z.string().trim().max(240).optional().nullable(),
})

export const productWriteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  shortDescription: z.string().trim().max(280).optional().nullable(),
  sku: z.string().trim().min(1, 'SKU is required'),
  basePrice: z.number().int().nonnegative('Price must be a non-negative integer (minor currency unit)'),
  compareAtPrice: z.number().int().nonnegative().optional().nullable(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  isFeatured: z.boolean().optional(),
  seoTitle: z.string().trim().max(160).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
  sizeGuideId: z.string().trim().optional().nullable(),
  categoryIds: z.array(z.string().trim()).optional(),
  layoutStyle: z.enum(['standard', 'landing']).optional(),
  landingBenefits: z.array(landingBenefitSchema).max(6).optional().nullable(),
  landingBlocks: z.array(landingBlockSchema).max(3).optional().nullable(),
})

export const productUpdateSchema = productWriteSchema.partial()

export const productListQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
})
