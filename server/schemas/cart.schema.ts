import { z } from 'zod'

export const addCartItemSchema = z.object({
  productId: z.string().trim().min(1),
  variantId: z.string().trim().optional().nullable(),
  quantity: z.number().int().positive().default(1),
})

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0),
})
