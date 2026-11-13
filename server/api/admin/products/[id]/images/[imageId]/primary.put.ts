import { createError } from 'h3'
import { defineApiHandler } from '../../../../../../utils/handler'
import { requireAdmin } from '../../../../../../utils/session'
import { productsRepository } from '../../../../../../repositories/products.repository'

/** Sets the given image as the product's primary/thumbnail photo (moves it to sortOrder 0). */
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  const imageId = event.context.params?.imageId
  if (!productId || !imageId) throw createError({ statusCode: 400, statusMessage: 'Missing product or image id' })

  const reordered = await productsRepository.setPrimaryImage(event, productId, imageId)
  if (!reordered) throw createError({ statusCode: 404, statusMessage: 'Image not found on this product' })
  return { images: reordered }
})
