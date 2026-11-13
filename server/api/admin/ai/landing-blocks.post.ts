import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { aiLandingBlocksSchema } from '../../../schemas/ai.schema'
import { aiService } from '../../../services/ai.service'

/** Generates lifestyle photo blocks (image + AI-written caption) for a Landing-style product page, for review before saving. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, aiLandingBlocksSchema)
  return aiService.generateLandingBlocks(event, input)
})
