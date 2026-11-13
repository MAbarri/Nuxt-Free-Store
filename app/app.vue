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

useHead({ htmlAttrs: { lang, dir } })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
