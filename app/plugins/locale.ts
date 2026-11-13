/**
 * Deliberately NOT using @nuxtjs/i18n's `detectBrowserLanguage` — that reads the
 * browser's Accept-Language/navigator.language, which we explicitly don't want
 * (every new visitor must see French, never an auto-detected language).
 *
 * Instead we manage persistence ourselves: a plain cookie that is only ever
 * written when the visitor *explicitly* picks a language via the switcher.
 * On load, if that cookie holds a valid locale, we restore it; otherwise the
 * configured `defaultLocale` ('fr') applies, with no detection involved.
 *
 * Uses `nuxtApp.$i18n` rather than the `useI18n()` composable: this file runs
 * as a plain Nuxt plugin, not inside a Vue component's `setup()`, and the
 * composable requires that component context.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const i18n = nuxtApp.$i18n as any
  const localeCookie = useCookie<string | null>('store_locale', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  const validCodes = i18n.locales.value.map((l: any) => (typeof l === 'string' ? l : l.code))

  if (localeCookie.value && validCodes.includes(localeCookie.value) && localeCookie.value !== i18n.locale.value) {
    await i18n.setLocale(localeCookie.value)
  }

  watch(i18n.locale, (next: string) => {
    localeCookie.value = next
  })
})
