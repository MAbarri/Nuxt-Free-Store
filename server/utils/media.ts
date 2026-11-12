import { createError, type H3Event } from 'h3'
import { generateId } from './id'

export interface StoredImage {
  key: string
  url: string
}

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
}

export function assertAllowedImageType(contentType: string): void {
  if (!(contentType in ALLOWED_TYPES)) {
    throw createError({ statusCode: 422, statusMessage: `Unsupported image type: ${contentType}` })
  }
}

export async function uploadImageToR2(
  event: H3Event,
  params: { data: Uint8Array | ArrayBuffer, contentType: string, folder: string },
): Promise<StoredImage> {
  const bucket = event.context.cloudflare?.env?.MEDIA
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'Media storage binding (MEDIA) is not available' })
  }

  assertAllowedImageType(params.contentType)
  const extension = ALLOWED_TYPES[params.contentType]
  const key = `${params.folder}/${generateId()}${extension}`

  await bucket.put(key, params.data, {
    httpMetadata: { contentType: params.contentType },
  })

  return { key, url: `/media/${key}` }
}

export async function deleteImageFromR2(event: H3Event, key: string): Promise<void> {
  const bucket = event.context.cloudflare?.env?.MEDIA
  if (!bucket) return
  await bucket.delete(key)
}

/** Extracts the R2 key from a `/media/<key>` url produced by uploadImageToR2. */
export function r2KeyFromUrl(url: string): string | null {
  const match = url.match(/^\/media\/(.+)$/)
  return match ? match[1] : null
}
