interface AnalyticsConfig {
  gaMeasurementId: string | null
  fbPixelId: string | null
}

// Module-scoped singleton (not `useState`): this composable is client-only by
// construction (every exported function bails out on the server before
// touching `window`), so there's no SSR payload to keep in sync — a plain
// module-level cache is simpler and avoids re-fetching settings on every
// client-side navigation.
let initPromise: Promise<void> | null = null
const config: AnalyticsConfig = { gaMeasurementId: null, fbPixelId: null }

function loadScriptOnce(id: string, src: string) {
  if (document.getElementById(id)) return
  const el = document.createElement('script')
  el.id = id
  el.async = true
  el.src = src
  document.head.appendChild(el)
}

/** Meta's standard Pixel base code, inlined (rather than loaded as a plain external <script>) so `window.fbq` exists synchronously right after this runs. */
function initFacebookPixel(pixelId: string) {
  const w = window as any
  if (!w.fbq) {
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return
      const n: any = f.fbq = function (...args: unknown[]) {
        if (n.callMethod) n.callMethod.apply(n, args)
        else n.queue.push(args)
      }
      if (!f._fbq) f._fbq = n
      n.push = n
      n.loaded = true
      n.version = '2.0'
      n.queue = []
      const t = b.createElement(e) as HTMLScriptElement
      t.async = true
      t.src = v
      const s = b.getElementsByTagName(e)[0]
      s.parentNode?.insertBefore(t, s)
    })(w, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  }
  w.fbq('init', pixelId)
}

async function ensureInit(): Promise<void> {
  if (import.meta.server) return
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const settings = await apiFetch<{ analytics?: AnalyticsConfig }>('/api/store-settings')
        config.gaMeasurementId = settings.analytics?.gaMeasurementId ?? null
        config.fbPixelId = settings.analytics?.fbPixelId ?? null
      }
      catch {
        // Analytics config failing to load should never break the storefront.
      }

      if (config.gaMeasurementId) {
        const w = window as any
        w.dataLayer = w.dataLayer || []
        w.gtag = w.gtag || function gtag(...args: unknown[]) { w.dataLayer.push(args) }
        w.gtag('js', new Date())
        // We fire GA4's `page_view` ourselves (see trackPageView) so it
        // fires consistently on client-side SPA navigations too.
        w.gtag('config', config.gaMeasurementId, { send_page_view: false })
        loadScriptOnce('ga4-gtag-js', `https://www.googletagmanager.com/gtag/js?id=${config.gaMeasurementId}`)
      }

      if (config.fbPixelId) {
        initFacebookPixel(config.fbPixelId)
      }
    })()
  }
  return initPromise
}

function gtagEvent(name: string, params?: Record<string, unknown>) {
  const w = window as any
  if (typeof w.gtag === 'function') w.gtag('event', name, params)
}

function fbqTrack(name: string, params?: Record<string, unknown>, eventId?: string) {
  const w = window as any
  if (typeof w.fbq === 'function') w.fbq('track', name, params, eventId ? { eventID: eventId } : undefined)
}

/**
 * Client-side GA4 + Meta Pixel facade. Both providers are entirely optional:
 * nothing loads unless its id is set in Settings → Analytics. Every exported
 * function is safe to call regardless of configuration — it just no-ops if
 * the relevant provider isn't set up (or we're on the server).
 *
 * All `value`/price fields here are already-converted major currency units
 * (e.g. 299, not 29900 cents) — convert at the call site.
 */
export function useAnalytics() {
  async function init() {
    if (import.meta.server) return
    await ensureInit()
  }

  async function trackPageView(path: string) {
    if (import.meta.server) return
    await ensureInit()
    gtagEvent('page_view', { page_path: path })
    fbqTrack('PageView')
  }

  async function trackViewContent(input: { id: string, name: string, value: number, currency?: string }) {
    if (import.meta.server) return
    await ensureInit()
    const currency = input.currency ?? 'MAD'
    gtagEvent('view_item', { currency, value: input.value, items: [{ item_id: input.id, item_name: input.name }] })
    fbqTrack('ViewContent', { content_ids: [input.id], content_name: input.name, content_type: 'product', currency, value: input.value })
  }

  async function trackAddToCart(input: { id: string, name: string, value: number, quantity: number, currency?: string }) {
    if (import.meta.server) return
    await ensureInit()
    const currency = input.currency ?? 'MAD'
    gtagEvent('add_to_cart', { currency, value: input.value, items: [{ item_id: input.id, item_name: input.name, quantity: input.quantity }] })
    fbqTrack('AddToCart', { content_ids: [input.id], content_name: input.name, content_type: 'product', currency, value: input.value })
  }

  async function trackInitiateCheckout(input: { value: number, contentIds: string[], numItems: number, currency?: string }) {
    if (import.meta.server) return
    await ensureInit()
    const currency = input.currency ?? 'MAD'
    gtagEvent('begin_checkout', { currency, value: input.value })
    fbqTrack('InitiateCheckout', { content_ids: input.contentIds, content_type: 'product', currency, value: input.value, num_items: input.numItems })
  }

  /**
   * `orderId` is passed through as the Pixel's `eventID` — the server-side
   * Facebook Conversion API Purchase event (server/services/analytics.service.ts)
   * uses the same order id as its `event_id`, so Meta dedupes the two instead
   * of double-counting one sale.
   */
  async function trackPurchase(input: { orderId: string, value: number, contentIds: string[], numItems: number, currency?: string }) {
    if (import.meta.server) return
    await ensureInit()
    const currency = input.currency ?? 'MAD'
    gtagEvent('purchase', { transaction_id: input.orderId, currency, value: input.value })
    fbqTrack('Purchase', { content_ids: input.contentIds, content_type: 'product', currency, value: input.value, num_items: input.numItems }, input.orderId)
  }

  return { init, trackPageView, trackViewContent, trackAddToCart, trackInitiateCheckout, trackPurchase }
}
