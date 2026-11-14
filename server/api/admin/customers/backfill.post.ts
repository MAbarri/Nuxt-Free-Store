import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { customersService } from '../../../services/customers.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return customersService.backfillFromOrders(event)
})
