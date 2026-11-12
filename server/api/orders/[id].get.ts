import { createError } from 'h3'
import { defineApiHandler } from '../../utils/handler'
import { ordersService } from '../../services/orders.service'

/**
 * Public lookup by opaque order id (not the human-friendly order number) —
 * this is what the confirmation page uses, and it works for guest checkout
 * without requiring an account. The id is an unguessable UUID, unlike the
 * more readable order number.
 */
export default defineApiHandler(async (event) => {
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  return ordersService.getDetail(event, id)
})
