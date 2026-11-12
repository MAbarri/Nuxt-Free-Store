import { createError } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { validateBody } from '../../../../utils/validate'
import { shippingRateUpdateSchema } from '../../../../schemas/shipping.schema'
import { shippingService } from '../../../../services/shipping.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const id = event.context.params?.id
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing rate id' })
  const input = await validateBody(event, shippingRateUpdateSchema)
  return shippingService.updateRate(event, id, input)
})
