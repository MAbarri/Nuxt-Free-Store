import { createError } from 'h3'

/**
 * Thin client for Meta's (Facebook) Conversion API — mirrors the shape of
 * server/utils/openrouter.ts: this file only knows how to talk to the Graph
 * API, not when/whether to call it (that's server/services/analytics.service.ts).
 */
const GRAPH_API_VERSION = 'v21.0'

/** SHA-256 hex digest, as required by Meta for hashed PII fields (em, ph) in Advanced Matching. Uses Web Crypto, available in both the Cloudflare Workers runtime and Node. */
export async function hashForMatching(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface ConversionEventInput {
  pixelId: string
  accessToken: string
  eventName: string
  /** Shared with the client-side Pixel's event so Meta dedupes instead of double-counting the same conversion. */
  eventId: string
  eventSourceUrl?: string
  userData: Record<string, unknown>
  customData: Record<string, unknown>
}

export async function sendConversionEvent(input: ConversionEventInput): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${input.pixelId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: input.accessToken,
      data: [{
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: input.userData,
        custom_data: input.customData,
      }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: 502, statusMessage: `Facebook Conversion API request failed (${res.status}): ${body}` })
  }
}
