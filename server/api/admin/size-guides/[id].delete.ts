import { createError } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { sizeGuidesService } from '../../../services/sizeGuides.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing size guide id' })
  await sizeGuidesService.remove(event, id)
  return { deleted: true }
})
