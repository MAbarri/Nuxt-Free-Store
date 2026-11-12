import { defineApiHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validate'
import { checkoutSchema } from '../../schemas/checkout.schema'
import { checkoutService } from '../../services/checkout.service'

export default defineApiHandler(async (event) => {
  const input = await validateBody(event, checkoutSchema)
  return checkoutService.createOrder(event, input)
})
