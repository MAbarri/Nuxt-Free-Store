import { z } from 'zod'

export const categoryWriteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  parentId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export const categoryUpdateSchema = categoryWriteSchema.partial()
