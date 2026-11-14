import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { AD_DESIGN_TYPES } from '../../../../services/marketing.service'

/** The selectable, categorized library of ad design types for the design picker in Marketing → Ads content generator. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  return AD_DESIGN_TYPES
})
