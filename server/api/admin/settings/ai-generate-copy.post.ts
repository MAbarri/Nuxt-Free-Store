import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { settingsService } from '../../../services/settings.service'

/** Writes fresh French homepage copy (hero, tagline, promo, trust badges) with AI, reflecting the actual store. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return settingsService.aiGenerateCopy(event)
})
