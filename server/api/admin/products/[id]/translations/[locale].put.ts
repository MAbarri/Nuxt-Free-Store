import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { validateBody } from '../../../../../utils/validate'
import { productTranslationWriteSchema } from '../../../../../schemas/translation.schema'
import { productsService } from '../../../../../services/products.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  const locale = event.context.params?.locale
  if (!id || (locale !== 'en' && locale !== 'ar')) {
    throw createError({ statusCode: 400, statusMessage: 'Missing/invalid product id or locale' })
  }
  const input = await validateBody(event, productTranslationWriteSchema)
  return productsService.upsertTranslation(event, id, locale, input)
})
