import { createError } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { productsRepository } from '../../../../../repositories/products.repository'
import { deleteImageFromR2, r2KeyFromUrl } from '../../../../../utils/media'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const imageId = event.context.params?.imageId
  if (!imageId) throw createError({ statusCode: 400, statusMessage: 'Missing image id' })

  const removed = await productsRepository.removeImage(event, imageId)
  if (removed) {
    const key = r2KeyFromUrl(removed.url)
    if (key) await deleteImageFromR2(event, key)
  }
  return { deleted: true }
})
