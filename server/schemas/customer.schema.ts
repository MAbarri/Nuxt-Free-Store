import { z } from 'zod'

export const customerListQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
})

export const customerNotesUpdateSchema = z.object({
  notes: z.string().trim().max(2000),
})
