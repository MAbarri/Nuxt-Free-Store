import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { attributeValueWriteSchema } from '../../../../schemas/attribute.schema'
import { attributesService } from '../../../../services/attributes.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const attributeId = event.context.params?.id
  if (!attributeId) throw createError({ statusCode: 400, statusMessage: 'Missing attribute id' })
  const input = await validateBody(event, attributeValueWriteSchema)
  const id = await attributesService.addValue(event, attributeId, input)
  return { id }
})
