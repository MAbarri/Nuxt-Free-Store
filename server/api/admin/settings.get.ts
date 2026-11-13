import { defineApiHandler } from '../../utils/handler'
import { requireAdmin } from '../../utils/session'
import { settingsService } from '../../services/settings.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return settingsService.getAdminSettings(event)
})
