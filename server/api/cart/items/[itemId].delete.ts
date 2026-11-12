import { createError } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { cartService } from '../../../services/cart.service'

export default defineApiHandler(async (event) => {
  const itemId = event.context.params?.itemId
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'Missing cart item id' })
  return cartService.removeItem(event, itemId)
})
