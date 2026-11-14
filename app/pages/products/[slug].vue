<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const slug = route.params.slug as string
const toast = useToast()

const { data: productRes, pending } = await useAsyncData(`product-${slug}`, () => apiFetch<any>(`/api/products/${slug}`))
const product = computed(() => productRes.value)

useHead({
  title: computed(() => product.value ? `${product.value.name} — Atelier Élégance` : 'Product — Atelier Élégance'),
  meta: [{ name: 'description', content: computed(() => product.value?.seoDescription ?? product.value?.shortDescription ?? '') }],
})

const activeImage = ref(0)
const sizeGuideOpen = ref(false)
const quantity = ref(1)
const adding = ref(false)

const imageCount = computed(() => product.value?.images.length ?? 0)
const { onPointerDown, onPointerUp, onPointerCancel } = useSwipeGallery(activeImage, imageCount)

const { selectedValues, attributeGroups, selectedVariant, displayPrice, inStock } = useProductVariants(product)

const { addItem: addCartItem } = useCart()
const { trackViewContent, trackAddToCart } = useAnalytics()

watch(product, (p) => {
  if (p) trackViewContent({ id: p.id, name: p.name, value: displayPrice.value / 100 })
}, { immediate: true })

async function addToCart() {
  if (!selectedVariant.value || !product.value) return
  adding.value = true
  try {
    await addCartItem(product.value.id, selectedVariant.value.id, quantity.value)
    trackAddToCart({ id: product.value.id, name: product.value.name, value: displayPrice.value / 100, quantity: quantity.value })
    toast.add({ title: t('product.addedToCart'), color: 'success' })
  }
  catch (e) {
    toast.add({ title: t('product.couldNotAddToCart'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    adding.value = false
  }
}

// Quantity-break discount preview — the real total is always the server's.
const quantityDiscountPreview = computed(() => {
  if (!product.value?.quantityDiscountMinQty || !product.value?.quantityDiscountPercent) return null
  return applyQuantityDiscount(displayPrice.value, quantity.value, product.value.quantityDiscountMinQty, product.value.quantityDiscountPercent)
})

// --- Frequently bought together (Roadmap Phase D) ---
const addingCompanionId = ref<string | null>(null)
const addingAllCompanions = ref(false)

async function addCompanionToCart(companion: any) {
  if (!companion.inStock || !companion.defaultVariantId) return
  addingCompanionId.value = companion.id
  try {
    await addCartItem(companion.id, companion.defaultVariantId, 1)
    toast.add({ title: t('product.addedToCart'), color: 'success' })
  }
  catch (e) {
    toast.add({ title: t('product.couldNotAddToCart'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    addingCompanionId.value = null
  }
}

async function addAllCompanionsToCart() {
  const available = (product.value?.upsells ?? []).filter((u: any) => u.inStock && u.defaultVariantId)
  if (!available.length) return
  addingAllCompanions.value = true
  try {
    for (const companion of available) {
      await addCartItem(companion.id, companion.defaultVariantId, 1)
    }
    toast.add({ title: t('product.addedAllToCart'), color: 'success' })
  }
  catch (e) {
    toast.add({ title: t('product.couldNotAddToCart'), description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    addingAllCompanions.value = false
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
        <div
          class="product-media aspect-[3/4] touch-pan-y select-none rounded-md"
          @pointerdown="onPointerDown"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
        >
          <img
            v-if="product.images[activeImage]"
            :src="product.images[activeImage].url"
            :alt="product.images[activeImage].altText ?? product.name"
            class="h-full w-full object-cover"
            draggable="false"
            @dragstart.prevent
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
          <span v-if="product.compareAtPrice" class="me-2 text-stone-400 line-through">{{ formatPrice(product.compareAtPrice) }}</span>
          {{ formatPrice(displayPrice) }}
        </p>
        <p v-if="product.quantityDiscountMinQty && product.quantityDiscountPercent" class="mt-1 text-sm font-medium text-clay-700">
          {{ t('product.quantityDiscountBadge', { minQty: product.quantityDiscountMinQty, percent: product.quantityDiscountPercent }) }}
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
                class="me-1.5 inline-block size-3 rounded-full border border-white/50 align-middle"
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
          {{ t('product.sizeGuide') }}
        </button>

        <p class="mt-4 text-sm" :class="inStock ? 'text-green-700' : 'text-stone-400'">
          <UIcon :name="inStock ? 'i-lucide-check-circle' : 'i-lucide-x-circle'" class="me-1 align-[-2px]" />
          {{ inStock ? t('product.inStock', { count: selectedVariant?.stock }) : t('product.outOfStock') }}
          <span v-if="selectedVariant" class="ms-2 text-stone-400">{{ t('common.sku') }}: {{ selectedVariant.sku }}</span>
        </p>

        <div class="mt-6 flex items-center gap-3">
          <UInputNumber v-model="quantity" :min="1" :max="selectedVariant?.stock ?? 1" class="w-28" />
          <UButton size="xl" :disabled="!inStock" :loading="adding" class="grow" @click="addToCart">
            {{ t('product.addToCart') }}
          </UButton>
        </div>
        <p v-if="quantityDiscountPreview?.discountApplied" class="mt-2 text-sm text-clay-700">
          {{ formatPrice(quantityDiscountPreview.subtotal) }} {{ t('common.total').toLowerCase() }} ({{ product.quantityDiscountPercent }}% off)
        </p>

        <div v-if="product.description" class="mt-8 border-t border-stone-200 pt-6 text-sm text-stone-600">
          {{ product.description }}
        </div>
      </div>
    </div>

    <!-- Frequently bought together -->
    <section v-if="product.upsells?.length" class="mt-20">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-2xl">
          {{ t('product.frequentlyBoughtTogether') }}
        </h2>
        <UButton
          v-if="product.upsells.some((u: any) => u.inStock)"
          size="sm" variant="soft" :loading="addingAllCompanions"
          @click="addAllCompanionsToCart"
        >
          {{ t('product.addAllToCart') }}
        </UButton>
      </div>
      <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div v-for="companion in product.upsells" :key="companion.id">
          <NuxtLink :to="`/products/${companion.slug}`" class="block">
            <div class="product-media aspect-[3/4] rounded-md">
              <img v-if="companion.imageUrl" :src="companion.imageUrl" :alt="companion.name" class="h-full w-full object-cover">
              <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
                <UIcon name="i-lucide-shirt" class="size-8" />
              </div>
            </div>
            <p class="mt-2 truncate text-sm font-medium">{{ companion.name }}</p>
            <p class="text-sm text-stone-500">{{ formatPrice(companion.price) }}</p>
          </NuxtLink>
          <UButton
            class="mt-2" size="xs" variant="soft" block
            :disabled="!companion.inStock"
            :loading="addingCompanionId === companion.id"
            @click="addCompanionToCart(companion)"
          >
            {{ companion.inStock ? t('product.addToCart') : t('product.outOfStock') }}
          </UButton>
        </div>
      </div>
    </section>

    <!-- Related products -->
    <section v-if="product.related?.length" class="mt-20">
      <h2 class="font-display text-2xl">
        {{ t('product.youMayAlsoLike') }}
      </h2>
      <ProductGrid class="mt-6" :products="product.related" />
    </section>

    <SizeGuideModal v-if="product.sizeGuide" v-model:open="sizeGuideOpen" :guide="product.sizeGuide" />
  </div>

  <UEmpty v-else icon="i-lucide-shirt" :title="t('product.notFound')" class="mx-auto max-w-7xl px-4 py-20" />
</template>
