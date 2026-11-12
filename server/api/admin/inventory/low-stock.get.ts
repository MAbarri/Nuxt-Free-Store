import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { validateQuery } from '../../../utils/validate'
import { inventoryService } from '../../../services/inventory.service'
import { z } from 'zod'

const querySchema = z.object({ threshold: z.coerce.number().int().positive().optional() })

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const { threshold } = validateQuery(event, querySchema)
  return inventoryService.lowStock(event, threshold)
})
