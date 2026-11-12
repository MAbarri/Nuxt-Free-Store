import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateQuery } from '../../../utils/validate'
import { productListQuerySchema } from '../../../schemas/product.schema'
import { productsService } from '../../../services/products.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const query = validateQuery(event, productListQuerySchema)
  return productsService.list(event, query)
})
