import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { orderStatusUpdateSchema } from '../../../../schemas/order.schema'
import { ordersService } from '../../../../services/orders.service'

export default defineApiHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  const { status, note } = await validateBody(event, orderStatusUpdateSchema)
  return ordersService.updateStatus(event, id, status, { note, adminUserId: admin.id })
})
