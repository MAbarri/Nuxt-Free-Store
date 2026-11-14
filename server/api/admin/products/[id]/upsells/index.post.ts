import { z } from 'zod'
import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { validateBody } from '../../../../../utils/validate'
import { productUpsellsService } from '../../../../../services/productUpsells.service'

const schema = z.object({ relatedProductId: z.string().trim().min(1) })

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  const input = await validateBody(event, schema)
  return productUpsellsService.add(event, productId, input.relatedProductId)
})
