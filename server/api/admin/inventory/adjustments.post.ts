import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateBody } from '../../../utils/validate'
import { inventoryAdjustSchema } from '../../../schemas/inventory.schema'
import { inventoryService } from '../../../services/inventory.service'

export default defineApiHandler(async (event) => {
  const admin = await requireAdmin(event)
  const input = await validateBody(event, inventoryAdjustSchema)
  const stock = await inventoryService.adjustStock(event, input.variantId, input.delta, input.reason, {
    note: input.note,
    createdByUserId: admin.id,
  })
  return { stock }
})
