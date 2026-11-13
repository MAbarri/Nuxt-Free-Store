/**
 * Loads GA4/Meta Pixel (if configured in Settings → Analytics) and fires a
 * page-view event on the initial load and every client-side navigation.
 * Deliberately storefront-only: admin is an internal tool, never tracked.
 *
 * Client-only (`.client.ts`) since there is nothing to inject server-side —
 * both providers are loaded by mutating `window`/`document` directly.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { init, trackPageView } = useAnalytics()

  function isAdminRoute(path: string) {
    return path.startsWith('/admin')
  }

  const initialRoute = useRoute()
  if (!isAdminRoute(initialRoute.path)) {
    init().then(() => trackPageView(initialRoute.fullPath))
  }

  nuxtApp.$router.afterEach((to) => {
    if (isAdminRoute(to.path)) return
    trackPageView(to.fullPath)
  })
})
