import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { attributesService } from '../../../../services/attributes.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const valueId = event.context.params?.valueId
  if (!valueId) throw createError({ statusCode: 400, statusMessage: 'Missing value id' })
  await attributesService.removeValue(event, valueId)
  return { deleted: true }
})
