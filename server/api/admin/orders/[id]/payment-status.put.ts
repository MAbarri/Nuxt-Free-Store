import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { orderPaymentStatusUpdateSchema } from '../../../../schemas/order.schema'
import { ordersService } from '../../../../services/orders.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  const { paymentStatus } = await validateBody(event, orderPaymentStatusUpdateSchema)
  return ordersService.updatePaymentStatus(event, id, paymentStatus)
})
