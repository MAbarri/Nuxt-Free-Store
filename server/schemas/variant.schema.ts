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

// Used by the "generate variants" admin UI to create every selected
// attribute combination in one request. `sku` is optional here (unlike
// variantWriteSchema) — the service derives one from the product's SKU and
// the chosen attribute values when it's left blank.
export const variantBulkWriteSchema = z.object({
  combos: z.array(z.object({
    attributeValueIds: z.array(z.string().trim()).min(1, 'Select at least one attribute value'),
    sku: z.string().trim().optional(),
    price: z.number().int().nonnegative().optional().nullable(),
    stock: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })).min(1).max(200),
})
