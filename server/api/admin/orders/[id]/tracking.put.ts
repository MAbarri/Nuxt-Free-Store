import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { orderTrackingUpdateSchema } from '../../../../schemas/order.schema'
import { ordersService } from '../../../../services/orders.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  const { trackingReference } = await validateBody(event, orderTrackingUpdateSchema)
  return ordersService.updateTracking(event, id, trackingReference)
})
