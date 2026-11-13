<script setup lang="ts">
const { t, locale, locales } = useI18n()

const items = computed(() => locales.value
  .filter(l => typeof l !== 'string')
  .map(l => ({ label: t(`language.${l.code}`), value: l.code })))

// Matches the cookie options in app/plugins/locale.ts.
const localeCookie = useCookie<string | null>('store_locale', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
})

function onChange(code: string) {
  localeCookie.value = code
  // Most storefront content (products, categories, homepage settings, SEO
  // meta) resolves its locale server-side from this cookie and was already
  // fetched before the switch, so a client-side i18n update alone leaves it
  // stale. A full reload re-requests everything with the new locale applied
  // everywhere at once, picked up on load by the plugin in plugins/locale.ts.
  window.location.reload()
}
</script>

<template>
  <USelect
    :model-value="locale"
    :items="items"
    :aria-label="t('language.label')"
    size="sm"
    class="w-[6.5rem]"
    @update:model-value="onChange"
  />
</template>
