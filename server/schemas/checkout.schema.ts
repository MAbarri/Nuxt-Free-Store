import { z } from 'zod'

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  phone: z.string().trim().min(6, 'A valid phone number is required'),
  email: z.string().trim().email().optional().or(z.literal('')).transform(v => v || undefined),
  city: z.string().trim().min(1, 'City is required'),
  addressLine: z.string().trim().min(1, 'Delivery address is required'),
  deliveryInstructions: z.string().trim().max(500).optional(),
})

export const checkoutQuoteSchema = z.object({
  city: z.string().trim().min(1, 'City is required'),
})
