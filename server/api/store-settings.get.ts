import { defineApiHandler } from '../utils/handler'
import { settingsService } from '../services/settings.service'

export default defineApiHandler(async (event) => {
  return await settingsService.getPublicSettings(event)
})
