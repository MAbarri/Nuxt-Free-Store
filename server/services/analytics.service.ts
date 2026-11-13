import { getCookie, getHeader, getRequestIP, type H3Event } from 'h3'
import { settingsService } from './settings.service'
import { hashForMatching, sendConversionEvent } from '../utils/metaConversionsApi'

export interface PurchaseEventInput {
  /** Shared as the Conversion API's event_id and the client Pixel's eventID, so Meta dedupes the two instead of double-counting one purchase. */
  orderId: string
  /** Minor currency units (cents) — converted to major units before sending. */
  total: number
  currency: string
  productIds: Array<string | null>
  numItems: number
  email?: string | null
  phone?: string | null
}

export const analyticsService = {
  /**
   * Fires a server-side Facebook Conversion API "Purchase" event right after
   * an order is saved. Works even if the customer's browser blocks the
   * client-side Pixel (ad blockers, ITP, etc.), which is why Meta recommends
   * it as the primary signal and the Pixel as a secondary one.
   *
   * No-ops silently if the access-token secret isn't set, the pixel id isn't
   * configured, or the "Enable server-side Conversion API" toggle is off in
   * settings — and never throws, so a misconfigured or failing call can never
   * break checkout.
   */
  async trackPurchase(event: H3Event, input: PurchaseEventInput): Promise<void> {
    try {
      const accessToken = event.context.cloudflare?.env?.FB_CONVERSIONS_ACCESS_TOKEN
      if (!accessToken) return

      const settings = await settingsService.getBase(event)
      const pixelId = settings.analytics.fbPixelId
      if (!settings.analytics.fbConversionsApiEnabled || !pixelId) return

      const userData: Record<string, unknown> = {}
      if (input.email) userData.em = [await hashForMatching(input.email.trim().toLowerCase())]
      // Meta expects digits only (no spaces/dashes/parens/leading '+').
      if (input.phone) userData.ph = [await hashForMatching(input.phone.replace(/\D/g, ''))]

      const clientIp = getRequestIP(event, { xForwardedFor: true })
      if (clientIp) userData.client_ip_address = clientIp
      const userAgent = getHeader(event, 'user-agent')
      if (userAgent) userData.client_user_agent = userAgent
      // Set by the Meta Pixel's base snippet in the visitor's browser; reading
      // them back here (when present) significantly improves event match quality.
      const fbp = getCookie(event, '_fbp')
      if (fbp) userData.fbp = fbp
      const fbc = getCookie(event, '_fbc')
      if (fbc) userData.fbc = fbc

      await sendConversionEvent({
        pixelId,
        accessToken,
        eventName: 'Purchase',
        eventId: input.orderId,
        eventSourceUrl: getHeader(event, 'referer'),
        userData,
        customData: {
          currency: input.currency,
          value: input.total / 100,
          content_ids: input.productIds.filter((id): id is string => !!id),
          content_type: 'product',
          num_items: input.numItems,
        },
      })
    }
    catch (error) {
      console.error('[analytics] Failed to send Facebook Conversion API Purchase event', error)
    }
  },
}
