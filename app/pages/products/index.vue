<script setup lang="ts">
useHead({ title: 'Shop — Atelier Élégance' })

const { data: categoriesRes } = await useAsyncData('products-categories', () => apiFetch<any[]>('/api/categories'))
const categories = computed(() => categoriesRes.value ?? [])

const { data: attributesRes } = await useAsyncData('products-attributes', () => apiFetch<any[]>('/api/attributes'))
const filterableAttributes = computed(() => (attributesRes.value ?? []).filter((a: any) => a.values.length))

const { page, sort, search, selectedValueIds, pageSize, products, total, loading, load, toggleValue }
  = useProductListing(() => undefined)

onMounted(load)

const quickViewSlug = ref<string | null>(null)
const quickViewOpen = ref(false)
function openQuickView(slug: string) {
  quickViewSlug.value = slug
  quickViewOpen.value = true
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between">
      <h1 class="font-display text-3xl">
        Shop
      </h1>
      <UInput v-model="search" placeholder="Search products…" icon="i-lucide-search" @keyup.enter="load" />
    </div>

    <div class="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
      <aside class="space-y-8">
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-stone-500">
            Categories
          </p>
          <ul class="mt-3 space-y-2 text-sm">
            <li v-for="category in categories" :key="category.id">
              <NuxtLink :to="`/category/${category.slug}`" class="text-stone-600 hover:text-stone-900">
                {{ category.name }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div v-for="attr in filterableAttributes" :key="attr.id">
          <p class="text-xs font-medium uppercase tracking-wide text-stone-500">
            {{ attr.name }}
          </p>
          <ul class="mt-3 space-y-2">
            <li v-for="value in attr.values" :key="value.id" class="flex items-center gap-2">
              <UCheckbox
                :model-value="selectedValueIds.includes(value.id)"
                @update:model-value="toggleValue(value.id)"
              />
              <span
                v-if="attr.displayType === 'swatch'"
                class="size-3.5 rounded-full border border-stone-300"
                :style="{ backgroundColor: value.swatchHex ?? undefined }"
              />
              <span class="text-sm text-stone-600">{{ value.value }}</span>
            </li>
          </ul>
        </div>
      </aside>

      <div>
        <div class="flex items-center justify-between">
          <p class="text-sm text-stone-500">
            {{ total }} products
          </p>
          <USelect
            v-model="sort"
            :items="[
              { label: 'Newest', value: 'newest' },
              { label: 'Price: low to high', value: 'price_asc' },
              { label: 'Price: high to low', value: 'price_desc' },
              { label: 'Most popular', value: 'popularity' },
            ]"
          />
        </div>

        <ProductGrid class="mt-6" :products="products" :loading="loading" @quickview="openQuickView" />

        <div v-if="total > pageSize" class="mt-10 flex justify-center">
          <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" />
        </div>
      </div>
    </div>

    <QuickViewModal v-model:open="quickViewOpen" :slug="quickViewSlug" />
  </div>
</template>
