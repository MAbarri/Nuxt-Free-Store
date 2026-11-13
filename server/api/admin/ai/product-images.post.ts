import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { aiProductImagesSchema } from '../../../schemas/ai.schema'
import { aiService } from '../../../services/ai.service'

/** Step 2 of the AI product wizard: generates N carousel shots consistent with the reference photo. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, aiProductImagesSchema)
  return aiService.generateImages(event, input)
})
