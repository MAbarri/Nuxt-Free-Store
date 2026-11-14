import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { productUpsellsService } from '../../../../../services/productUpsells.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  const upsellId = event.context.params?.upsellId
  if (!productId || !upsellId) throw createError({ statusCode: 400, statusMessage: 'Missing product or companion id' })
  return productUpsellsService.remove(event, productId, upsellId)
})
