<script setup lang="ts">
const { t } = useI18n()

defineProps<{
  products: any[]
  loading?: boolean
  emptyMessage?: string
}>()
const emit = defineEmits<{ quickview: [slug: string] }>()
</script>

<template>
  <div v-if="loading" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
    <div v-for="i in 8" :key="i">
      <USkeleton class="product-media rounded-md" />
      <USkeleton class="mt-3 h-4 w-3/4" />
      <USkeleton class="mt-2 h-4 w-1/3" />
    </div>
  </div>

  <UEmpty
    v-else-if="!products.length"
    icon="i-lucide-shirt"
    :title="emptyMessage ?? t('productGrid.noProductsFound')"
    :description="t('productGrid.tryAdjusting')"
  />

  <div v-else class="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
    <ProductCard v-for="product in products" :key="product.id" :product="product" @quickview="emit('quickview', $event)" />
  </div>
</template>
