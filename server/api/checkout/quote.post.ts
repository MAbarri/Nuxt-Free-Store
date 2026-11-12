import { defineApiHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validate'
import { checkoutQuoteSchema } from '../../schemas/checkout.schema'
import { checkoutService } from '../../services/checkout.service'

export default defineApiHandler(async (event) => {
  const { city } = await validateBody(event, checkoutQuoteSchema)
  return checkoutService.quote(event, city)
})
