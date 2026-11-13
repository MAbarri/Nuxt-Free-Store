import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { aiTranslateSchema } from '../../../schemas/translation.schema'
import { settingsService } from '../../../services/settings.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const { locales } = await validateBody(event, aiTranslateSchema)
  return settingsService.aiTranslate(event, locales)
})
