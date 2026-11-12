import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { productWriteSchema } from '../../../schemas/product.schema'
import { productsService } from '../../../services/products.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, productWriteSchema)
  return productsService.create(event, input)
})
