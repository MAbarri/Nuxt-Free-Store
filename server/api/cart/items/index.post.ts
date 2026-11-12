import { defineApiHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validate'
import { addCartItemSchema } from '../../../schemas/cart.schema'
import { cartService } from '../../../services/cart.service'

export default defineApiHandler(async (event) => {
  const input = await validateBody(event, addCartItemSchema)
  return cartService.addItem(event, input)
})
