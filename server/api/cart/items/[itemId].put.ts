import { createError } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validate'
import { updateCartItemSchema } from '../../../schemas/cart.schema'
import { cartService } from '../../../services/cart.service'

export default defineApiHandler(async (event) => {
  const itemId = event.context.params?.itemId
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'Missing cart item id' })
  const { quantity } = await validateBody(event, updateCartItemSchema)
  return cartService.updateItemQuantity(event, itemId, quantity)
})
