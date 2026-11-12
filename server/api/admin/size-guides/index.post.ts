import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { sizeGuideWriteSchema } from '../../../schemas/sizeGuide.schema'
import { sizeGuidesService } from '../../../services/sizeGuides.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, sizeGuideWriteSchema)
  return sizeGuidesService.create(event, input)
})
