import { z } from 'zod'

export const shippingZoneCreateSchema = z.object({
  name: z.string().trim().min(1),
  freeShippingThreshold: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const shippingZoneUpdateSchema = shippingZoneCreateSchema.partial()

export const shippingRateCreateSchema = z.object({
  zoneId: z.string().trim().min(1),
  city: z.string().trim().min(1),
  fee: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
})

export const shippingRateUpdateSchema = z.object({
  city: z.string().trim().min(1).optional(),
  fee: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
})
