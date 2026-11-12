import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { shippingZoneCreateSchema } from '../../../../schemas/shipping.schema'
import { shippingService } from '../../../../services/shipping.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const input = await validateBody(event, shippingZoneCreateSchema)
  return shippingService.createZone(event, input)
})
