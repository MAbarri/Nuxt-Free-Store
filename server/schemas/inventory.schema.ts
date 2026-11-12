import { z } from 'zod'

export const inventoryAdjustSchema = z.object({
  variantId: z.string().trim().min(1),
  delta: z.number().int().refine(v => v !== 0, 'Delta must not be zero'),
  reason: z.enum(['manual_adjustment', 'restock']),
  note: z.string().trim().max(500).optional(),
})
