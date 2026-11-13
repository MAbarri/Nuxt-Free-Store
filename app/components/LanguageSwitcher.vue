<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()

const items = computed(() => locales.value
  .filter(l => typeof l !== 'string')
  .map(l => ({ label: t(`language.${l.code}`), value: l.code })))

function onChange(code: string) {
  setLocale(code as 'fr' | 'en' | 'ar')
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
