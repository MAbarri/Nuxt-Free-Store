import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { SOCIAL_POST_PROMPT_TYPES } from '../../../../services/marketing.service'

/** The selectable, categorized library of post "angles" for the prompt-type picker in Marketing → Social post generator. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return SOCIAL_POST_PROMPT_TYPES
})
