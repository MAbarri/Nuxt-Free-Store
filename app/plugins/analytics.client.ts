/**
 * Loads GA4/Meta Pixel (if configured in Settings → Analytics) and fires a
 * page-view event on the initial load and every client-side navigation.
 * Deliberately storefront-only: admin is an internal tool, never tracked.
 *
 * Client-only (`.client.ts`) since there is nothing to inject server-side —
 * both providers are loaded by mutating `window`/`document` directly.
 *
 * `router.afterEach` alone covers the initial page load too (Vue Router
 * fires it once for the very first route resolution, not just subsequent
 * navigations), so a separate explicit call for the initial route would
 * double-fire `page_view` for every landing page — confirmed by seeing two
 * identical `page_view` events queued in `dataLayer` on first load.
 * `trackPageView` already awaits `ensureInit()` internally, so there's no
 * need to bootstrap the providers separately here either.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { trackPageView } = useAnalytics()

  function isAdminRoute(path: string) {
    return path.startsWith('/admin')
  }

  nuxtApp.$router.afterEach((to) => {
    if (isAdminRoute(to.path)) return
    trackPageView(to.fullPath)
  })
})
