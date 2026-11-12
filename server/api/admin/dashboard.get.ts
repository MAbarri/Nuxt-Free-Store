import { defineApiHandler } from '../../utils/handler'
import { requireAdmin } from '../../utils/session'
import { dashboardService } from '../../services/dashboard.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return dashboardService.overview(event)
})
