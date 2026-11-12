import { z } from 'zod'

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
})

export const productUpdateSchema = productWriteSchema.partial()

export const productListQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
})
