import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { variantsService } from '../../../../../services/variants.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const variantId = event.context.params?.variantId
  if (!variantId) throw createError({ statusCode: 400, statusMessage: 'Missing variant id' })
  await variantsService.remove(event, variantId)
  return { deleted: true }
})
