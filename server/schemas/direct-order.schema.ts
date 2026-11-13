import { z } from 'zod'

// Places an order directly for a single product/variant, bypassing the cart —
// used by Landing-style product pages' embedded order form (see checkout.service.ts
// `createDirectOrder`).
export const directOrderSchema = z.object({
  productId: z.string().trim().min(1, 'Missing product'),
  variantId: z.string().trim().min(1, 'Missing variant'),
  quantity: z.coerce.number().int().positive().max(50),
  fullName: z.string().trim().min(1, 'Full name is required'),
  phone: z.string().trim().min(6, 'A valid phone number is required'),
  email: z.string().trim().email().optional().or(z.literal('')).transform(v => v || undefined),
  city: z.string().trim().min(1, 'City is required'),
  addressLine: z.string().trim().min(1, 'Delivery address is required'),
  deliveryInstructions: z.string().trim().max(500).optional(),
})
