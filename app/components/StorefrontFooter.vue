<script setup lang="ts">
const { t } = useI18n()

const { data: settings } = await useAsyncData('store-settings-footer', () => apiFetch<any>('/api/store-settings'))
const storeName = computed(() => settings.value?.storeName ?? 'Atelier Élégance')
const tagline = computed(() => settings.value?.tagline ?? '')
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-stone-200 bg-stone-50">
    <div class="mx-auto max-w-7xl px-4 py-12 text-sm text-stone-600 sm:px-6 lg:px-8">
      <div class="grid gap-8 sm:grid-cols-3">
        <div>
          <p class="font-display text-lg uppercase tracking-[0.18em] text-stone-900">
            {{ storeName }}
          </p>
          <p class="mt-2">
            {{ tagline }}
          </p>
        </div>
        <div>
          <p class="font-medium text-stone-900">{{ t('footer.shopHeading') }}</p>
          <ul class="mt-2 space-y-1">
            <li><NuxtLink to="/products">{{ t('footer.allProducts') }}</NuxtLink></li>
            <li><NuxtLink to="/categories">{{ t('footer.categoriesLink') }}</NuxtLink></li>
          </ul>
        </div>
        <div>
          <p class="font-medium text-stone-900">{{ t('footer.supportHeading') }}</p>
          <ul class="mt-2 space-y-1">
            <li><NuxtLink to="/account/orders">{{ t('footer.trackOrder') }}</NuxtLink></li>
            <li><NuxtLink to="/">{{ t('footer.shippingReturns') }}</NuxtLink></li>
          </ul>
        </div>
      </div>
      <p class="mt-10 text-xs text-stone-400">{{ t('footer.copyright', { year, name: storeName }) }}</p>
    </div>
  </footer>
</template>
