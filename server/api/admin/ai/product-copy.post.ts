import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { aiProductCopySchema } from '../../../schemas/ai.schema'
import { aiService } from '../../../services/ai.service'

/** Step 1 of the AI product wizard: writes French copy from the reference photo, then translates it to en/ar. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, aiProductCopySchema)
  return aiService.generateCopy(event, input)
})
