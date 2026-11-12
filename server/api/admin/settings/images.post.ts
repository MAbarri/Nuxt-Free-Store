import { createError, readMultipartFormData } from 'h3'
import { defineApiHandler } from '../../../utils/handler'
import { requireAdmin } from '../../../utils/session'
import { uploadImageToR2 } from '../../../utils/media'

export default defineApiHandler(async (event) => {
  await requireAdmin(event)

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file' && p.filename)
  if (!filePart) throw createError({ statusCode: 422, statusMessage: 'Missing "file" field' })

  const { url } = await uploadImageToR2(event, {
    data: filePart.data,
    contentType: filePart.type || 'application/octet-stream',
    folder: 'settings',
  })

  return { url }
})
