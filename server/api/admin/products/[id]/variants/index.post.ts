import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { validateBody } from '../../../../../utils/validate'
import { variantWriteSchema } from '../../../../../schemas/variant.schema'
import { variantsService } from '../../../../../services/variants.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  const input = await validateBody(event, variantWriteSchema)
  return variantsService.create(event, productId, input)
})
