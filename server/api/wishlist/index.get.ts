import { defineApiHandler } from '../../utils/handler'
import { wishlistService } from '../../services/wishlist.service'

export default defineApiHandler(async (event) => {
  return wishlistService.list(event)
})
