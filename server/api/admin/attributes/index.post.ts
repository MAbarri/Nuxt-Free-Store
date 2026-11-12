import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { attributeWriteSchema } from '../../../schemas/attribute.schema'
import { attributesService } from '../../../services/attributes.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, attributeWriteSchema)
  const id = await attributesService.create(event, input)
  return { id }
})
