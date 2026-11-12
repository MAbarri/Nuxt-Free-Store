import { createError, readMultipartFormData } from 'h3'
import { defineApiHandler } from '../../../../../utils/handler'
import { requireAdmin } from '../../../../../utils/session'
import { uploadImageToR2 } from '../../../../../utils/media'
import { productsRepository } from '../../../../../repositories/products.repository'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })

  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw createError({ statusCode: 422, statusMessage: 'No file uploaded' })

  const filePart = parts.find(p => p.name === 'file' && p.filename)
  if (!filePart) throw createError({ statusCode: 422, statusMessage: 'Missing "file" field' })

  const altTextPart = parts.find(p => p.name === 'altText')
  const altText = altTextPart ? new TextDecoder().decode(altTextPart.data) : undefined

  const { url } = await uploadImageToR2(event, {
    data: filePart.data,
    contentType: filePart.type || 'application/octet-stream',
    folder: `products/${productId}`,
  })

  const existing = await productsRepository.listImages(event, productId)
  const imageId = await productsRepository.addImage(event, productId, {
    url,
    altText,
    sortOrder: existing.length,
  })

  return { id: imageId, url, altText: altText ?? null }
})
