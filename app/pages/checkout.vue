<script setup lang="ts">
const { t } = useI18n()
useHead({ title: 'Checkout — Atelier Élégance' })

const toast = useToast()
const { cart, refresh: refreshCart } = useCart()
await useAsyncData('checkout-cart', refreshCart)

const { trackInitiateCheckout, trackPurchase } = useAnalytics()
if (cart.value.items.length) {
  trackInitiateCheckout({
    value: cart.value.subtotal / 100,
    contentIds: cart.value.items.map(i => i.productId),
    numItems: cart.value.items.reduce((sum, i) => sum + i.quantity, 0),
  })
}

const form = reactive({
  fullName: '',
  phone: '',
  email: '',
  city: '',
  addressLine: '',
  deliveryInstructions: '',
})

const quote = ref<{ subtotal: number, shippingFee: number, total: number, freeShippingApplied: boolean } | null>(null)
const quoteError = ref('')
const quoting = ref(false)
let quoteTimer: ReturnType<typeof setTimeout> | undefined

async function fetchQuote() {
  if (!form.city.trim()) {
    quote.value = null
    return
  }
  quoting.value = true
  quoteError.value = ''
  try {
    quote.value = await apiFetch('/api/checkout/quote', { method: 'POST', body: { city: form.city } })
  }
  catch (e) {
    quote.value = null
    quoteError.value = apiErrorMessage(e)
  }
  finally {
    quoting.value = false
  }
}

watch(() => form.city, () => {
  clearTimeout(quoteTimer)
  quoteTimer = setTimeout(fetchQuote, 500)
})

const submitting = ref(false)
const submitError = ref('')

async function submit() {
  submitting.value = true
  submitError.value = ''
  try {
    const order = await apiFetch<{ id: string, total: number, items: Array<{ productId: string | null, quantity: number }> }>(
      '/api/checkout',
      { method: 'POST', body: { ...form, email: form.email || undefined } },
    )
    trackPurchase({
      orderId: order.id,
      value: order.total / 100,
      contentIds: order.items.map(i => i.productId).filter((id): id is string => !!id),
      numItems: order.items.reduce((sum, i) => sum + i.quantity, 0),
    })
    await refreshCart()
    await navigateTo(`/order-confirmation/${order.id}`)
  }
  catch (e) {
    submitError.value = apiErrorMessage(e)
    toast.add({ title: t('checkout.couldNotPlaceOrder'), description: submitError.value, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <h1 class="font-display text-3xl">
      {{ t('checkout.title') }}
    </h1>

    <UEmpty
      v-if="!cart.items.length"
      icon="i-lucide-shopping-bag"
      :title="t('checkout.emptyTitle')"
      :description="t('checkout.emptyDescription')"
      class="mt-10"
      :actions="[{ label: t('common.shopNow'), to: '/products' }]"
    />

    <div v-else class="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
      <form class="space-y-5" @submit.prevent="submit">
        <h2 class="text-sm font-medium uppercase tracking-wide text-stone-500">
          {{ t('checkout.deliveryInformation') }}
        </h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('checkout.fullName')" class="sm:col-span-2">
            <UInput v-model="form.fullName" required class="w-full" />
          </UFormField>
          <UFormField :label="t('checkout.phone')">
            <UInput v-model="form.phone" required class="w-full" />
          </UFormField>
          <UFormField :label="t('checkout.emailOptional')">
            <UInput v-model="form.email" type="email" class="w-full" />
          </UFormField>
          <UFormField :label="t('checkout.city')" :error="quoteError" class="sm:col-span-2">
            <UInput v-model="form.city" required class="w-full" />
          </UFormField>
          <UFormField :label="t('checkout.address')" class="sm:col-span-2">
            <UTextarea v-model="form.addressLine" required :rows="2" class="w-full" />
          </UFormField>
          <UFormField :label="t('checkout.deliveryInstructionsOptional')" class="sm:col-span-2">
            <UTextarea v-model="form.deliveryInstructions" :rows="2" class="w-full" />
          </UFormField>
        </div>

        <UButton type="submit" size="lg" block :loading="submitting" :disabled="!quote">
          {{ t('checkout.placeOrder') }}
        </UButton>
        <p class="text-center text-xs text-stone-400">
          {{ t('checkout.cashNote') }}
        </p>
      </form>

      <div class="h-fit space-y-4 rounded-lg border border-stone-200 bg-white p-6">
        <h2 class="text-sm font-medium uppercase tracking-wide text-stone-500">
          {{ t('checkout.orderSummary') }}
        </h2>
        <ul class="space-y-3">
          <li v-for="item in cart.items" :key="item.id" class="flex justify-between gap-3 text-sm">
            <span class="text-stone-600">
              {{ item.productName }}
              <span v-if="item.variantLabel" class="text-stone-400"> ({{ item.variantLabel }})</span>
              × {{ item.quantity }}
            </span>
            <span>{{ formatPrice(item.subtotal) }}</span>
          </li>
        </ul>

        <div class="space-y-1 border-t border-stone-200 pt-4 text-sm">
          <div class="flex justify-between">
            <span>{{ t('common.subtotal') }}</span>
            <span>{{ formatPrice(cart.subtotal) }}</span>
          </div>
          <div class="flex justify-between">
            <span>{{ t('common.shipping') }}</span>
            <span v-if="quoting">…</span>
            <span v-else-if="quote">
              <template v-if="quote.freeShippingApplied">{{ t('common.free') }}</template>
              <template v-else>{{ formatPrice(quote.shippingFee) }}</template>
            </span>
            <span v-else class="text-stone-400">{{ t('checkout.enterCity') }}</span>
          </div>
          <div class="flex justify-between font-medium text-base pt-2">
            <span>{{ t('common.total') }}</span>
            <span>{{ quote ? formatPrice(quote.total) : formatPrice(cart.subtotal) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
