import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { aiProductCreateSchema } from '../../../schemas/ai.schema'
import { aiService } from '../../../services/ai.service'

/** Final step of the AI product wizard: persists the reviewed/edited output as a real product. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, aiProductCreateSchema)
  return aiService.createProduct(event, input)
})
