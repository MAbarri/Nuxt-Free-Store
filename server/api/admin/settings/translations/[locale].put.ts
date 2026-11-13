import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { settingsTranslationWriteSchema } from '../../../../schemas/translation.schema'
import { settingsService } from '../../../../services/settings.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const locale = event.context.params?.locale
  if (locale !== 'en' && locale !== 'ar') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid locale' })
  }
  const input = await validateBody(event, settingsTranslationWriteSchema)
  return settingsService.upsertTranslation(event, locale, input)
})
