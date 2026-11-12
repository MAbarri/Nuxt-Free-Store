import { z } from 'zod'

const sizeGuideRowSchema = z.record(z.string(), z.string())

export const sizeGuideContentSchema = z.object({
  columns: z.array(z.string()).min(1),
  rows: z.array(sizeGuideRowSchema).min(1),
})

export const sizeGuideWriteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  content: sizeGuideContentSchema,
  categoryId: z.string().trim().optional().nullable(),
})

export const sizeGuideUpdateSchema = sizeGuideWriteSchema.partial()
