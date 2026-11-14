import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { aiConfigService } from '../../../services/aiConfig.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return aiConfigService.getConfig(event)
})
