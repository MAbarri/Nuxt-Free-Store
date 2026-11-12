import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateQuery } from '../../../utils/validate'
import { orderListQuerySchema } from '../../../schemas/order.schema'
import { ordersService } from '../../../services/orders.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const query = validateQuery(event, orderListQuerySchema)
  return ordersService.list(event, query)
})
