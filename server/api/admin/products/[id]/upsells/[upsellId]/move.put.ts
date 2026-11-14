import { z } from 'zod'
import { createError } from 'h3'
import { defineApiHandler } from '../../../../../../utils/handler'
import { requireAdmin } from '../../../../../../utils/session'
import { validateBody } from '../../../../../../utils/validate'
import { productUpsellsService } from '../../../../../../services/productUpsells.service'

const schema = z.object({ direction: z.enum(['up', 'down']) })

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  const upsellId = event.context.params?.upsellId
  if (!productId || !upsellId) throw createError({ statusCode: 400, statusMessage: 'Missing product or companion id' })
  const input = await validateBody(event, schema)
  return productUpsellsService.move(event, productId, upsellId, input.direction)
})
