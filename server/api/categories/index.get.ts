import { defineApiHandler } from '../../utils/handler'
import { storefrontCategoriesService } from '../../services/storefrontCategories.service'

export default defineApiHandler(async (event) => {
  return storefrontCategoriesService.list(event)
})
