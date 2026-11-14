import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { adCreativeGenerateSchema } from '../../../../schemas/marketing.schema'
import { marketingService } from '../../../../services/marketing.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, adCreativeGenerateSchema)
  return marketingService.generateAdCreative(event, input)
})
