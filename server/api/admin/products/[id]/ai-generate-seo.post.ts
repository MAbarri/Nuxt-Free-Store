import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { productsService } from '../../../../services/products.service'

/** Writes French SEO title/description for this product from its existing name/description. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  return productsService.aiGenerateSeo(event, id)
})
