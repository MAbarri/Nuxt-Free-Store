import { defineApiHandler } from '../../utils/handler'
import { cartService } from '../../services/cart.service'

export default defineApiHandler(async (event) => {
  return cartService.clear(event)
})
