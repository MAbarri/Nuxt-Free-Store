import { createError } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { categoryUpdateSchema } from '../../../schemas/category.schema'
import { categoriesService } from '../../../services/categories.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing category id' })
  const input = await validateBody(event, categoryUpdateSchema)
  return categoriesService.update(event, id, input)
})
