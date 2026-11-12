import { z } from 'zod'

export const storefrontProductQuerySchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  attributeValueIds: z.union([z.string(), z.array(z.string())]).optional()
    .transform(v => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popularity']).optional(),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
})
