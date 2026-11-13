import { z } from 'zod'
import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { productsService } from '../../../../services/products.service'

const schema = z.object({
  blocks: z.array(z.object({
    imageDataUrl: z.string().trim().regex(/^data:image\/(png|jpe?g|webp);base64,/),
    caption: z.string().trim().max(200).optional(),
  })).min(1).max(3),
})

/** Persists admin-reviewed AI-generated lifestyle blocks (see /api/admin/ai/landing-blocks) into an existing product's landingBlocks. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  const { blocks } = await validateBody(event, schema)
  return productsService.addGeneratedLandingBlocks(event, id, blocks.map(b => ({ imageDataUrl: b.imageDataUrl, caption: b.caption ?? '' })))
})
