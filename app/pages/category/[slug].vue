<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string

const { data: categoryRes } = await useAsyncData(`category-${slug}`, () => apiFetch<any>(`/api/categories/${slug}`))
const category = computed(() => categoryRes.value)

useHead({ title: computed(() => `${category.value?.name ?? 'Category'} — Atelier`) })

const { page, sort, products, total, loading, load, pageSize } = useProductListing(() => slug)
onMounted(load)

const quickViewSlug = ref<string | null>(null)
const quickViewOpen = ref(false)
function openQuickView(s: string) {
  quickViewSlug.value = s
  quickViewOpen.value = true
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <template v-if="category">
      <h1 class="font-display text-3xl">
        {{ category.name }}
      </h1>
      <p v-if="category.description" class="mt-2 max-w-2xl text-stone-600">
        {{ category.description }}
      </p>
    </template>

    <div class="mt-6 flex items-center justify-between">
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

    <ProductGrid
      class="mt-6"
      :products="products"
      :loading="loading"
      empty-message="No products in this category yet"
      @quickview="openQuickView"
    />

    <div v-if="total > pageSize" class="mt-10 flex justify-center">
      <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" />
    </div>

    <QuickViewModal v-model:open="quickViewOpen" :slug="quickViewSlug" />
  </div>
</template>
