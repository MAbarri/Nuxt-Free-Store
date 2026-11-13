import { defineApiHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validate'
import { directOrderSchema } from '../../schemas/direct-order.schema'
import { checkoutService } from '../../services/checkout.service'

export default defineApiHandler(async (event) => {
  const input = await validateBody(event, directOrderSchema)
  return checkoutService.createDirectOrder(event, input)
})
