import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { aiTranslateLandingBlocksSchema } from '../../../schemas/ai.schema'
import { aiService } from '../../../services/ai.service'

/** Translates a list of lifestyle-block captions (aligned by index) into English and Arabic. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const { captions } = await validateBody(event, aiTranslateLandingBlocksSchema)
  return aiService.translateLandingBlocks(event, captions)
})
