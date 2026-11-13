<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string
const toast = useToast()

const { data: productRes, pending } = await useAsyncData(`product-${slug}`, () => $fetch(`/api/products/${slug}`))
const product = computed(() => productRes.value?.data)

useHead({
  title: computed(() => product.value ? `${product.value.name} — Atelier` : 'Product — Atelier'),
  meta: [{ name: 'description', content: computed(() => product.value?.seoDescription ?? product.value?.shortDescription ?? '') }],
})

const activeImage = ref(0)
const sizeGuideOpen = ref(false)
const quantity = ref(1)
const adding = ref(false)

const { selectedValues, attributeGroups, selectedVariant, displayPrice, inStock } = useProductVariants(product)

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

const { addItem: addCartItem } = useCart()

async function addToCart() {
  if (!selectedVariant.value || !product.value) return
  adding.value = true
  try {
    await addCartItem(product.value.id, selectedVariant.value.id, quantity.value)
    toast.add({ title: 'Added to cart', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Could not add to cart', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    adding.value = false
  }
}

</script>

<template>
  <div v-if="pending" class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <USkeleton class="h-96 w-full" />
  </div>

  <div v-else-if="product && product.layoutStyle === 'landing'">
    <ProductLandingPage :product="product" />
  </div>

  <div v-else-if="product" class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-2">
      <!-- Gallery -->
      <div>
        <div class="product-media aspect-[3/4] rounded-md">
          <img
            v-if="product.images[activeImage]"
            :src="product.images[activeImage].url"
            :alt="product.images[activeImage].altText ?? product.name"
            class="h-full w-full object-cover"
          >
          <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
            <UIcon name="i-lucide-image" class="size-10" />
          </div>
        </div>
        <div v-if="product.images.length > 1" class="mt-3 flex gap-2">
          <button
            v-for="(image, i) in product.images" :key="image.id"
            type="button"
            class="size-16 overflow-hidden rounded-md border"
            :class="i === activeImage ? 'border-stone-900' : 'border-stone-200'"
            @click="activeImage = i"
          >
            <img :src="image.url" :alt="image.altText ?? ''" class="h-full w-full object-cover">
          </button>
        </div>
      </div>

      <!-- Info -->
      <div>
        <p v-if="product.categories[0]" class="text-xs uppercase tracking-widest text-stone-500">
          {{ product.categories[0].name }}
        </p>
        <h1 class="mt-2 font-display text-3xl">
          {{ product.name }}
        </h1>

        <p class="mt-3 text-lg">
          <span v-if="product.compareAtPrice" class="mr-2 text-stone-400 line-through">{{ formatPrice(product.compareAtPrice) }}</span>
          {{ formatPrice(displayPrice) }}
        </p>

        <p v-if="product.shortDescription" class="mt-4 text-stone-600">
          {{ product.shortDescription }}
        </p>

        <div v-for="group in attributeGroups" :key="group.attributeId" class="mt-6">
          <p class="text-xs font-medium uppercase tracking-wide text-stone-500">
            {{ group.attributeName }}
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="value in group.values" :key="value.valueId"
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm"
              :class="selectedValues[group.attributeId] === value.valueId ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-700'"
              @click="selectedValues[group.attributeId] = value.valueId"
            >
              <span
                v-if="group.displayType === 'swatch'"
                class="mr-1.5 inline-block size-3 rounded-full border border-white/50 align-middle"
                :style="{ backgroundColor: value.swatchHex ?? undefined }"
              />
              {{ value.value }}
            </button>
          </div>
        </div>

        <button
          v-if="product.sizeGuide"
          type="button"
          class="mt-3 text-sm text-stone-500 underline"
          @click="sizeGuideOpen = true"
        >
          Size guide
        </button>

        <p class="mt-4 text-sm" :class="inStock ? 'text-green-700' : 'text-stone-400'">
          <UIcon :name="inStock ? 'i-lucide-check-circle' : 'i-lucide-x-circle'" class="mr-1 align-[-2px]" />
          {{ inStock ? `In stock (${selectedVariant?.stock} available)` : 'Out of stock' }}
          <span v-if="selectedVariant" class="ml-2 text-stone-400">SKU: {{ selectedVariant.sku }}</span>
        </p>

        <div class="mt-6 flex items-center gap-3">
          <UInputNumber v-model="quantity" :min="1" :max="selectedVariant?.stock ?? 1" class="w-28" />
          <UButton size="xl" :disabled="!inStock" :loading="adding" class="grow" @click="addToCart">
            Add to cart
          </UButton>
        </div>

        <div v-if="product.description" class="mt-8 border-t border-stone-200 pt-6 text-sm text-stone-600">
          {{ product.description }}
        </div>
      </div>
    </div>

    <!-- Related products -->
    <section v-if="product.related?.length" class="mt-20">
      <h2 class="font-display text-2xl">
        You may also like
      </h2>
      <ProductGrid class="mt-6" :products="product.related" />
    </section>

    <SizeGuideModal v-if="product.sizeGuide" v-model:open="sizeGuideOpen" :guide="product.sizeGuide" />
  </div>

  <UEmpty v-else icon="i-lucide-shirt" title="Product not found" class="mx-auto max-w-7xl px-4 py-20" />
</template>
