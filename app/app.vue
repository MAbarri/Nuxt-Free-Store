<script setup lang="ts">
const route = useRoute()
const { locale, locales } = useI18n()

// Admin is an internal tool, deliberately kept English-only/LTR regardless of
// whatever language a customer may have selected on the storefront. Checked by
// route rather than layout so it also covers layout-less pages like /admin/login.
const isAdmin = computed(() => route.path.startsWith('/admin'))

const dir = computed(() => {
  if (isAdmin.value) return 'ltr'
  const current = locales.value.find(l => typeof l !== 'string' && l.code === locale.value)
  return (current && typeof current !== 'string' ? current.dir : undefined) ?? 'ltr'
})
const lang = computed(() => (isAdmin.value ? 'en' : locale.value))

const { data: settingsRes } = await useAsyncData('app-shell-settings', () => apiFetch<any>('/api/store-settings'))

const gtmContainerId = computed(() => (isAdmin.value ? null : settingsRes.value?.analytics?.gtmContainerId ?? null))

useHead({
  htmlAttrs: { lang, dir },
  link: computed(() => settingsRes.value?.faviconUrl ? [{ rel: 'icon', href: settingsRes.value.faviconUrl }] : []),
  // The <noscript> half of Google Tag Manager's official install snippet —
  // the <script> half (which covers the vast majority of real visitors) is
  // handled client-side by useAnalytics.ts's initGtmContainer, right next to
  // the Facebook Pixel/GA4 setup it already does the same way.
  noscript: computed(() => gtmContainerId.value
    ? [{
        tagPosition: 'bodyOpen',
        innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmContainerId.value}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
      }]
    : []),
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
