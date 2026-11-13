import { createError, readMultipartFormData } from 'h3'
import { defineApiHandler } from '../../../../utils/handler'
import { requireAdmin } from '../../../../utils/session'
import { uploadImageToR2 } from '../../../../utils/media'

// Uploads a lifestyle/editorial image for a Landing-style product page.
// These live outside `product_images` (the regular gallery) — the caller
// stores the returned URL in the product's `landingBlocks` field instead.
export default defineApiHandler(async (event) => {
  await requireAdmin(event)
  const productId = event.context.params?.id
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Missing product id' })

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file' && p.filename)
  if (!filePart) throw createError({ statusCode: 422, statusMessage: 'Missing "file" field' })

  const { url } = await uploadImageToR2(event, {
    data: filePart.data,
    contentType: filePart.type || 'application/octet-stream',
    folder: `products/${productId}/landing`,
  })

  return { url }
})
