import { createError } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { wishlistService } from '../../../services/wishlist.service'

export default defineApiHandler(async (event) => {
  const productId = event.context.params?.productId
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  return wishlistService.removeItem(event, productId)
})
