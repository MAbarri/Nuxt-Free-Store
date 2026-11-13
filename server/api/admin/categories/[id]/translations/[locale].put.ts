import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { validateBody } from '../../../../../utils/validate'
import { categoryTranslationWriteSchema } from '../../../../../schemas/translation.schema'
import { categoriesService } from '../../../../../services/categories.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  const locale = event.context.params?.locale
  if (!id || (locale !== 'en' && locale !== 'ar')) {
    throw createError({ statusCode: 400, statusMessage: 'Missing/invalid category id or locale' })
  }
  const input = await validateBody(event, categoryTranslationWriteSchema)
  return categoriesService.upsertTranslation(event, id, locale, input)
})
