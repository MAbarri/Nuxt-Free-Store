import { z } from 'zod'

export const attributeWriteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  displayType: z.enum(['text', 'select', 'swatch']).default('select'),
})

export const attributeValueWriteSchema = z.object({
  value: z.string().trim().min(1, 'Value is required'),
  swatchHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  swatchImageUrl: z.string().trim().optional().nullable(),
  sortOrder: z.number().int().optional(),
})
