import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { categoriesService } from '../../../services/categories.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return categoriesService.list(event)
})
