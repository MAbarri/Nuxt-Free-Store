import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { productUpsellsService } from '../../../../../services/productUpsells.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  return productUpsellsService.listForAdmin(event, productId)
})
