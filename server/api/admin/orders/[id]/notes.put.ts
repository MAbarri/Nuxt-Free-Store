import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { orderNotesUpdateSchema } from '../../../../schemas/order.schema'
import { ordersService } from '../../../../services/orders.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  const { internalNotes } = await validateBody(event, orderNotesUpdateSchema)
  return ordersService.updateNotes(event, id, internalNotes)
})
