import { createError } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { productUpdateSchema } from '../../../schemas/product.schema'
import { productsService } from '../../../services/products.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  const input = await validateBody(event, productUpdateSchema)
  return productsService.update(event, id, input)
})
