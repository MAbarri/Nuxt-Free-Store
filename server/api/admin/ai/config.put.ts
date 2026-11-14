import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { aiConfigUpdateSchema } from '../../../schemas/ai.schema'
import { aiConfigService } from '../../../services/aiConfig.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, aiConfigUpdateSchema)
  return aiConfigService.updateConfig(event, input)
})
