import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateQuery } from '../../../utils/validate'
import { inventoryListQuerySchema } from '../../../schemas/inventory.schema'
import { inventoryService } from '../../../services/inventory.service'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const query = validateQuery(event, inventoryListQuerySchema)
  return inventoryService.listVariants(event, query)
})
