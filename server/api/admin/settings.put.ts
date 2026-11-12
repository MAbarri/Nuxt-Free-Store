import { defineApiHandler } from '../../utils/handler'
import { requireAdmin } from '../../utils/session'
import { validateBody } from '../../utils/validate'
import { settingsUpdateSchema } from '../../schemas/settings.schema'
import { settingsService } from '../../services/settings.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, settingsUpdateSchema)
  return settingsService.updateMany(event, input)
})
