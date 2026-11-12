import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { categoryWriteSchema } from '../../../schemas/category.schema'
import { categoriesService } from '../../../services/categories.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, categoryWriteSchema)
  return categoriesService.create(event, input)
})
