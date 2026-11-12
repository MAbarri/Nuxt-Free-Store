import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { z } from 'zod'
import { ordersService } from '../../../../services/orders.service'

const cancelSchema = z.object({ note: z.string().trim().max(500).optional() })

export default defineApiHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing order id' })
  const { note } = await validateBody(event, cancelSchema)
  return ordersService.cancel(event, id, { note, adminUserId: admin.id })
})
