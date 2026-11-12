import { createError, defineEventHandler, setHeader } from 'h3'

/** Serves R2-stored product/category media. Public, cached aggressively since keys are content-addressed. */
export default defineEventHandler(async (event) => {
  const path = event.context.params?.path
  if (!path) throw createError({ statusCode: 400, statusMessage: 'Missing media path' })

  const bucket = event.context.cloudflare?.env?.MEDIA
  if (!bucket) throw createError({ statusCode: 500, statusMessage: 'Media storage binding (MEDIA) is not available' })

  const object = await bucket.get(path)
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  setHeader(event, 'content-type', object.httpMetadata?.contentType || 'application/octet-stream')
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
  setHeader(event, 'etag', object.httpEtag)

  return object.body
})
