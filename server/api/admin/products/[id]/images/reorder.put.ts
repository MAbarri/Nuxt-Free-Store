import { z } from 'zod'
import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { validateBody } from '../../../../../utils/validate'
import { productsRepository } from '../../../../../repositories/products.repository'

const schema = z.object({ imageIds: z.array(z.string()).min(1) })

/** Persists a new gallery order from the admin's drag-to-reorder UI. */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  const input = await validateBody(event, schema)
  const images = await productsRepository.reorderImages(event, productId, input.imageIds)
  return { images }
})
