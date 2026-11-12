import { defineApiHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validate'
import { addWishlistItemSchema } from '../../../schemas/wishlist.schema'
import { wishlistService } from '../../../services/wishlist.service'

export default defineApiHandler(async (event) => {
  const input = await validateBody(event, addWishlistItemSchema)
  return wishlistService.addItem(event, input.productId, input.variantId)
})
