import { z } from 'zod'
import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { productsService } from '../../../../services/products.service'

const schema = z.object({
  imageDataUrls: z.array(z.string().trim().regex(/^data:image\/(png|jpe?g|webp);base64,/)).min(1).max(6),
})

/** Persists admin-reviewed AI-generated photos (see /api/admin/ai/product-images) into an existing product's gallery. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  const { imageDataUrls } = await validateBody(event, schema)
  return productsService.addGeneratedImages(event, id, imageDataUrls)
})
