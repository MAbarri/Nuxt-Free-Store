import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { attributesService } from '../../../services/attributes.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return attributesService.list(event)
})
