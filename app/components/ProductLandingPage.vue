<script setup lang="ts">
const props = defineProps<{ product: any }>()
const toast = useToast()

const activeImage = ref(0)
const sizeGuideOpen = ref(false)
const quantity = ref(1)

const productRef = computed(() => props.product)
const { selectedValues, attributeGroups, selectedVariant, displayPrice, inStock } = useProductVariants(productRef)

const { data: settingsRes } = await useAsyncData('landing-store-settings', () => apiFetch<any>('/api/store-settings'))
const trustBadges = computed(() => settingsRes.value?.trustBadges ?? [])

const form = reactive({
  fullName: '',
  phone: '',
  city: '',
  addressLine: '',
  deliveryInstructions: '',
})

const submitting = ref(false)
const submitError = ref('')

async function submitOrder() {
  if (!selectedVariant.value || !props.product) return
  submitting.value = true
  submitError.value = ''
  try {
    const order = await apiFetch<{ id: string }>('/api/checkout/direct', {
      method: 'POST',
      body: {
        productId: props.product.id,
        variantId: selectedVariant.value.id,
        quantity: quantity.value,
        fullName: form.fullName,
        phone: form.phone,
        city: form.city,
        addressLine: form.addressLine,
        deliveryInstructions: form.deliveryInstructions || undefined,
      },
    })
    await navigateTo(`/order-confirmation/${order.id}`)
  }
  catch (e) {
    submitError.value = apiErrorMessage(e)
    toast.add({ title: 'Impossible de passer la commande', description: submitError.value, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}

// Sticky bottom bar only appears once the visitor scrolls past the main order card.
const orderFormEl = ref<HTMLElement | null>(null)
const showStickyBar = ref(false)
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (!orderFormEl.value) return
  observer = new IntersectionObserver(([entry]) => {
    showStickyBar.value = !entry.isIntersecting
  }, { threshold: 0 })
  observer.observe(orderFormEl.value)
})
onUnmounted(() => observer?.disconnect())

function scrollToOrderForm() {
  orderFormEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 pb-28 pt-10 sm:px-6">
    <!-- Gallery -->
    <div class="product-media aspect-[4/5] rounded-md">
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

    <p v-if="product.categories[0]" class="mt-8 text-xs uppercase tracking-widest text-stone-500">
      {{ product.categories[0].name }}
    </p>
    <h1 class="mt-2 font-display text-3xl">
      {{ product.name }}
    </h1>

    <p class="mt-3 text-xl">
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
      Guide des tailles
    </button>

    <div class="mt-6 flex items-center gap-3">
      <UInputNumber v-model="quantity" :min="1" :max="selectedVariant?.stock ?? 1" class="w-28" />
      <p class="text-sm" :class="inStock ? 'text-green-700' : 'text-stone-400'">
        <UIcon :name="inStock ? 'i-lucide-check-circle' : 'i-lucide-x-circle'" class="mr-1 align-[-2px]" />
        {{ inStock ? `En stock (${selectedVariant?.stock} disponibles)` : 'Rupture de stock' }}
      </p>
    </div>

    <!-- Embedded direct-order form: this replaces cart/checkout for Landing-style products -->
    <div ref="orderFormEl" class="mt-8 rounded-lg border border-stone-200 bg-white p-6">
      <h2 class="text-sm font-medium uppercase tracking-wide text-stone-500">
        Informations de commande
      </h2>
      <form class="mt-4 space-y-4" @submit.prevent="submitOrder">
        <UFormField label="Nom complet">
          <UInput v-model="form.fullName" required class="w-full" />
        </UFormField>
        <UFormField label="Téléphone">
          <UInput v-model="form.phone" required class="w-full" />
        </UFormField>
        <UFormField label="Ville">
          <UInput v-model="form.city" required class="w-full" />
        </UFormField>
        <UFormField label="Adresse de livraison">
          <UTextarea v-model="form.addressLine" required :rows="2" class="w-full" />
        </UFormField>
        <UFormField label="Instructions de livraison (facultatif)">
          <UTextarea v-model="form.deliveryInstructions" :rows="2" class="w-full" />
        </UFormField>

        <UButton type="submit" size="xl" block :disabled="!inStock" :loading="submitting">
          Commander — Paiement à la livraison
        </UButton>
        <p v-if="submitError" class="text-center text-sm text-red-600">
          {{ submitError }}
        </p>
        <p class="text-center text-xs text-stone-400">
          Les frais de livraison sont confirmés lors de la validation de votre commande. Payez en espèces à la réception — aucune carte requise.
        </p>
      </form>
    </div>

    <!-- Benefits -->
    <section v-if="product.landingBenefits?.length" class="mt-16">
      <h2 class="font-display text-2xl">
        Pourquoi vous allez l'aimer
      </h2>
      <ul class="mt-6 space-y-4">
        <li v-for="(benefit, i) in product.landingBenefits" :key="i" class="flex items-start gap-3 text-stone-700">
          <span v-if="benefit.icon" class="text-xl leading-none">{{ benefit.icon }}</span>
          <span>{{ benefit.text }}</span>
        </li>
      </ul>
    </section>

    <!-- Lifestyle photo + copy blocks -->
    <section v-if="product.landingBlocks?.length" class="mt-16 space-y-10">
      <div v-for="(block, i) in product.landingBlocks" :key="i">
        <div class="product-media aspect-[4/3] rounded-md">
          <img :src="block.imageUrl" :alt="block.caption ?? product.name" class="h-full w-full object-cover">
        </div>
        <p v-if="block.caption" class="mt-3 text-stone-600">
          {{ block.caption }}
        </p>
      </div>
    </section>

    <!-- Trust badges (store-wide) -->
    <section v-if="trustBadges.length" class="mt-16 grid grid-cols-1 gap-4 border-t border-stone-200 pt-8 sm:grid-cols-3">
      <div v-for="(badge, i) in trustBadges" :key="i" class="flex items-center gap-3 text-sm text-stone-600">
        <span v-if="badge.icon" class="text-lg leading-none">{{ badge.icon }}</span>
        <span>{{ badge.label }}</span>
      </div>
    </section>

    <SizeGuideModal v-if="product.sizeGuide" v-model:open="sizeGuideOpen" :guide="product.sizeGuide" />

    <!-- Sticky bottom CTA, appears once scrolled past the order card -->
    <Transition name="fade">
      <div v-if="showStickyBar" class="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div class="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">
              {{ product.name }}
            </p>
            <p class="text-sm text-stone-500">
              {{ formatPrice(displayPrice) }}
            </p>
          </div>
          <UButton size="lg" :disabled="!inStock" @click="scrollToOrderForm">
            Commander
          </UButton>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
