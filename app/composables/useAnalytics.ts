interface AnalyticsConfig {
  gaMeasurementId: string | null
  gtmContainerId: string | null
  clarityProjectId: string | null
  fbPixelId: string | null
}

// Module-scoped singleton (not `useState`): this composable is client-only by
// construction (every exported function bails out on the server before
// touching `window`), so there's no SSR payload to keep in sync — a plain
// module-level cache is simpler and avoids re-fetching settings on every
// client-side navigation.
let initPromise: Promise<void> | null = null
const config: AnalyticsConfig = { gaMeasurementId: null, gtmContainerId: null, clarityProjectId: null, fbPixelId: null }

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

/** Google's standard Tag Manager base code (the <script> half of the official install snippet — see Admin → Install Google Tag Manager in tagmanager.google.com), inlined so it runs exactly as documented. The matching <noscript> fallback (for JS-disabled browsers) is injected separately, right after &lt;body&gt;, by app.vue. */
function initGtmContainer(containerId: string) {
  const w = window as any
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  (function (w2: any, d: Document, s: string, l: string, i: string) {
    if (d.getElementById(`gtm-script-${i}`)) return
    const f = d.getElementsByTagName(s)[0]
    const j = d.createElement(s) as HTMLScriptElement
    const dl = l !== 'dataLayer' ? `&l=${l}` : ''
    j.id = `gtm-script-${i}`
    j.async = true
    j.src = `https://www.googletagmanager.com/gtm.js?id=${i}${dl}`
    f.parentNode?.insertBefore(j, f)
  })(w, document, 'script', 'dataLayer', containerId)
}

/** Microsoft Clarity's standard tracking code, inlined as-is (straight from clarity.microsoft.com → Settings → Setup) so it runs exactly as Microsoft documents it. Clarity manages its own script tag/queue internally; there's no further setup call needed beyond loading it with the project id baked in. */
function initClarity(projectId: string) {
  const w = window as any
  if (w.clarity) return
  (function (c: any, l: Document, a: string, r: string, i: string) {
    c[a] = c[a] || function (...args: unknown[]) { (c[a].q = c[a].q || []).push(args) }
    const t = l.createElement(r) as HTMLScriptElement
    t.async = true
    t.src = `https://www.clarity.ms/tag/${i}`
    const y = l.getElementsByTagName(r)[0]
    y.parentNode?.insertBefore(t, y)
  })(w, document, 'clarity', 'script', projectId)
}

async function ensureInit(): Promise<void> {
  if (import.meta.server) return
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const settings = await apiFetch<{ analytics?: AnalyticsConfig }>('/api/store-settings')
        config.gaMeasurementId = settings.analytics?.gaMeasurementId ?? null
        config.gtmContainerId = settings.analytics?.gtmContainerId ?? null
        config.clarityProjectId = settings.analytics?.clarityProjectId ?? null
        config.fbPixelId = settings.analytics?.fbPixelId ?? null
      }
      catch {
        // Analytics config failing to load should never break the storefront.
      }

      // The dataLayer + gtag() shim is shared by both mechanisms below (and
      // by every gtagEvent() call elsewhere in this file) — GTM's own
      // official snippet doesn't define `gtag`, only `dataLayer`, but our
      // event tracking calls gtag('event', …) regardless of which of the
      // two is configured, so we always set it up once either id is present.
      if (config.gaMeasurementId || config.gtmContainerId) {
        const w = window as any
        w.dataLayer = w.dataLayer || []
        w.gtag = w.gtag || function gtag(...args: unknown[]) { w.dataLayer.push(args) }
      }

      if (config.gaMeasurementId) {
        const w = window as any
        w.gtag('js', new Date())
        // We fire GA4's `page_view` ourselves (see trackPageView) so it
        // fires consistently on client-side SPA navigations too.
        w.gtag('config', config.gaMeasurementId, { send_page_view: false })
        // IMPORTANT: a destination-specific Google tag ID (G-… for GA4,
        // AW-… for Ads, DC-… for Floodlight) must be loaded via the
        // `gtag/js` endpoint. Loading it via `gtm.js` (the *container*
        // loader, meant for GTM-… ids) is Google's documented "unsupported
        // implementation": the script loads with no visible error, but the
        // container never reads the gtag('config') call, so zero events
        // ever reach GA4. (A previous attempt here used gtm.js, which was
        // the actual cause of GA4 Realtime staying empty — not a Consent
        // Mode or ad-blocker issue as first suspected.)
        // https://support.google.com/tagmanager/answer/17231523
        loadScriptOnce('ga4-gtag-js', `https://www.googletagmanager.com/gtag/js?id=${config.gaMeasurementId}`)
      }

      if (config.gtmContainerId) {
        // A Google Tag Manager *container* id (GTM-…) is the other valid
        // case — opposite of the one above: it must load via `gtm.js`, per
        // Google's own install instructions (Admin → Install Google Tag
        // Manager). The container manages its own internal tags/triggers
        // (e.g. a GA4 Configuration tag) from tagmanager.google.com, so
        // there's no equivalent of the gtag('config', …) call to make here
        // — simply loading the container is the whole integration.
        initGtmContainer(config.gtmContainerId)
      }

      if (config.clarityProjectId) {
        initClarity(config.clarityProjectId)
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
