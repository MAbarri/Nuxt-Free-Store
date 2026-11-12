import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { inventoryService } from '../../../../../services/inventory.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const variantId = event.context.params?.variantId
  if (!variantId) throw createError({ statusCode: 400, statusMessage: 'Missing variant id' })
  return inventoryService.history(event, variantId)
})
