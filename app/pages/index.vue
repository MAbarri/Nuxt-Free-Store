<script setup lang="ts">
const { t } = useI18n()

const { data: settingsRes } = await useAsyncData('home-settings', () => apiFetch<any>('/api/store-settings'))
const settings = computed(() => settingsRes.value)

useSeoMeta({
  title: () => settings.value ? `${settings.value.storeName} — ${settings.value.tagline}` : 'Atelier Élégance',
  description: () => settings.value?.tagline,
  ogTitle: () => settings.value?.storeName,
  ogDescription: () => settings.value?.tagline,
})

const { data: featuredRes, pending: featuredLoading } = await useAsyncData('home-featured', () =>
  apiFetch<{ rows: any[] }>('/api/products', { query: { featured: true, pageSize: 4 } }))
const featured = computed(() => featuredRes.value?.rows ?? [])

const { data: latestRes, pending: latestLoading } = await useAsyncData('home-latest', () =>
  apiFetch<{ rows: any[] }>('/api/products', { query: { sort: 'newest', pageSize: 8 } }))
const latest = computed(() => latestRes.value?.rows ?? [])

const { data: categoriesRes } = await useAsyncData('home-categories', () => apiFetch<any[]>('/api/categories'))
const categories = computed(() => categoriesRes.value ?? [])

const quickViewSlug = ref<string | null>(null)
const quickViewOpen = ref(false)
function openQuickView(slug: string) {
  quickViewSlug.value = slug
  quickViewOpen.value = true
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative flex min-h-[70vh] items-end overflow-hidden bg-stone-900 text-white sm:min-h-[80vh]">
      <img
        v-if="settings?.hero?.imageUrl"
        :src="settings.hero.imageUrl"
        alt=""
        class="absolute inset-0 h-full w-full object-cover opacity-70"
      >
      <div class="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <p class="text-xs uppercase tracking-widest text-white/70">{{ t('home.heroEyebrow') }}</p>
        <h1 class="mt-3 max-w-xl font-display text-4xl sm:text-5xl">
          {{ settings?.hero?.title }}
        </h1>
        <p class="mt-4 max-w-md text-white/80">
          {{ settings?.hero?.subtitle }}
        </p>
        <UButton class="mt-8" size="xl" :to="settings?.hero?.ctaHref ?? '/products'">
          {{ settings?.hero?.ctaLabel ?? t('home.heroCtaDefault') }}
        </UButton>
      </div>
    </section>

    <!-- Categories -->
    <section v-if="categories.length" class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 class="font-display text-2xl">
        {{ t('home.shopByCategory') }}
      </h2>
      <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="`/category/${category.slug}`"
          class="group relative overflow-hidden rounded-md"
        >
          <div class="product-media">
            <img
              v-if="category.imageUrl"
              :src="category.imageUrl"
              :alt="category.name"
              class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            >
            <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
              <UIcon name="i-lucide-shirt" class="size-8" />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <p class="absolute bottom-3 start-3 font-display text-lg text-white">
              {{ category.name }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Featured products -->
    <section v-if="featuredLoading || featured.length" class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-2xl">
          {{ t('home.featured') }}
        </h2>
        <NuxtLink to="/products" class="text-sm uppercase tracking-wide hover:underline">
          {{ t('common.viewAll') }}
        </NuxtLink>
      </div>
      <ProductGrid class="mt-6" :products="featured" :loading="featuredLoading" @quickview="openQuickView" />
    </section>

    <!-- Promo -->
    <section class="bg-clay-50 py-12">
      <div class="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 class="font-display text-2xl">
          {{ settings?.promo?.title }}
        </h2>
        <p class="mt-2 text-stone-600">
          {{ settings?.promo?.subtitle }}
        </p>
      </div>
    </section>

    <!-- Latest products -->
    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-2xl">
          {{ t('home.newArrivals') }}
        </h2>
        <NuxtLink to="/products?sort=newest" class="text-sm uppercase tracking-wide hover:underline">
          {{ t('common.viewAll') }}
        </NuxtLink>
      </div>
      <ProductGrid class="mt-6" :products="latest" :loading="latestLoading" @quickview="openQuickView" />
    </section>

    <QuickViewModal v-model:open="quickViewOpen" :slug="quickViewSlug" />
  </div>
</template>
