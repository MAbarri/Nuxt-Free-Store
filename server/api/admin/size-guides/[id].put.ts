import { createError } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { sizeGuideUpdateSchema } from '../../../schemas/sizeGuide.schema'
import { sizeGuidesService } from '../../../services/sizeGuides.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing size guide id' })
  const input = await validateBody(event, sizeGuideUpdateSchema)
  return sizeGuidesService.update(event, id, input)
})
