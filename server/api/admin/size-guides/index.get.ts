import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { sizeGuidesService } from '../../../services/sizeGuides.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return sizeGuidesService.list(event)
})
