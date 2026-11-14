import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { marketingService } from '../../../../services/marketing.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing post id' })
  await marketingService.deleteSavedPost(event, id)
  return { deleted: true }
})
