import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { marketingService } from '../../../../services/marketing.service'

/** Saved history of AI-generated social posts, newest first. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return marketingService.listSavedPosts(event)
})
