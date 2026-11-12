import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateQuery } from '../../../utils/validate'
import { customerListQuerySchema } from '../../../schemas/customer.schema'
import { customersService } from '../../../services/customers.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const query = validateQuery(event, customerListQuerySchema)
  return customersService.list(event, query)
})
