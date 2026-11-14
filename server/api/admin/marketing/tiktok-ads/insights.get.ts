import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { marketingService } from '../../../../services/marketing.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return marketingService.tiktokAdsInsights(event)
})
