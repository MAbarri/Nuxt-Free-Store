import { createError } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { categoriesService } from '../../../services/categories.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing category id' })
  return categoriesService.get(event, id)
})
