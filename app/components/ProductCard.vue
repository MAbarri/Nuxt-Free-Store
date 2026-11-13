<script setup lang="ts">
const { t } = useI18n()

interface ProductCardDto {
  id: string
  name: string
  slug: string
  basePrice: number
  compareAtPrice: number | null
  minPrice: number
  maxPrice: number
  primaryImageUrl: string | null
  inStock: boolean
  swatches: Array<{ valueId: string, value: string, swatchHex: string | null }>
}

defineProps<{ product: ProductCardDto }>()
const emit = defineEmits<{ quickview: [slug: string] }>()
</script>

<template>
  <div class="group">
    <NuxtLink :to="`/products/${product.slug}`" class="product-media block rounded-md">
      <img
        v-if="product.primaryImageUrl"
        :src="product.primaryImageUrl"
        :alt="product.name"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        loading="lazy"
      >
      <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
        <UIcon name="i-lucide-image" class="size-8" />
      </div>

      <span
        v-if="!product.inStock"
        class="absolute start-2 top-2 rounded-full bg-stone-900/80 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white"
      >
        {{ t('productCard.soldOut') }}
      </span>
      <span
        v-else-if="product.compareAtPrice"
        class="absolute start-2 top-2 rounded-full bg-clay-600 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white"
      >
        {{ t('productCard.sale') }}
      </span>

      <button
        type="button"
        class="absolute bottom-2 end-2 rounded-full bg-white/90 p-2 opacity-0 shadow transition group-hover:opacity-100"
        :aria-label="t('productCard.quickView')"
        @click.prevent="emit('quickview', product.slug)"
      >
        <UIcon name="i-lucide-eye" class="size-4" />
      </button>
    </NuxtLink>

    <div class="mt-3">
      <NuxtLink :to="`/products/${product.slug}`" class="font-medium hover:underline">
        {{ product.name }}
      </NuxtLink>
      <p class="mt-1 text-sm text-stone-500">
        <span v-if="product.compareAtPrice" class="me-2 text-stone-400 line-through">{{ formatPrice(product.compareAtPrice) }}</span>
        <span v-if="product.minPrice !== product.maxPrice">{{ formatPrice(product.minPrice) }}–{{ formatPrice(product.maxPrice) }}</span>
        <span v-else>{{ formatPrice(product.minPrice) }}</span>
      </p>
      <div v-if="product.swatches?.length" class="mt-2 flex gap-1">
        <span
          v-for="swatch in product.swatches"
          :key="swatch.valueId"
          class="size-3.5 rounded-full border border-stone-300"
          :style="{ backgroundColor: swatch.swatchHex ?? undefined }"
          :title="swatch.value"
        />
      </div>
    </div>
  </div>
</template>
