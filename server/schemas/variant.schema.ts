import { z } from 'zod'

export const variantWriteSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required'),
  price: z.number().int().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative().optional(),
  imageUrl: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
  attributeValueIds: z.array(z.string().trim()).optional(),
})

export const variantUpdateSchema = variantWriteSchema.partial().omit({ stock: true })
