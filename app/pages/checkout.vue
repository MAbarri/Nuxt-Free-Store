<script setup lang="ts">
useHead({ title: 'Checkout — Atelier Élégance' })

const toast = useToast()
const { cart, refresh: refreshCart } = useCart()
await useAsyncData('checkout-cart', refreshCart)

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
    const order = await apiFetch<{ id: string }>('/api/checkout', { method: 'POST', body: { ...form, email: form.email || undefined } })
    await refreshCart()
    await navigateTo(`/order-confirmation/${order.id}`)
  }
  catch (e) {
    submitError.value = apiErrorMessage(e)
    toast.add({ title: 'Could not place order', description: submitError.value, color: 'error' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <h1 class="font-display text-3xl">
      Checkout
    </h1>

    <UEmpty
      v-if="!cart.items.length"
      icon="i-lucide-shopping-bag"
      title="Your cart is empty"
      description="Add something to your cart before checking out."
      class="mt-10"
      :actions="[{ label: 'Shop now', to: '/products' }]"
    />

    <div v-else class="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
      <form class="space-y-5" @submit.prevent="submit">
        <h2 class="text-sm font-medium uppercase tracking-wide text-stone-500">
          Delivery information
        </h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Full name" class="sm:col-span-2">
            <UInput v-model="form.fullName" required class="w-full" />
          </UFormField>
          <UFormField label="Phone number">
            <UInput v-model="form.phone" required class="w-full" />
          </UFormField>
          <UFormField label="Email (optional)">
            <UInput v-model="form.email" type="email" class="w-full" />
          </UFormField>
          <UFormField label="City" :error="quoteError" class="sm:col-span-2">
            <UInput v-model="form.city" required class="w-full" />
          </UFormField>
          <UFormField label="Full delivery address" class="sm:col-span-2">
            <UTextarea v-model="form.addressLine" required :rows="2" class="w-full" />
          </UFormField>
          <UFormField label="Delivery instructions (optional)" class="sm:col-span-2">
            <UTextarea v-model="form.deliveryInstructions" :rows="2" class="w-full" />
          </UFormField>
        </div>

        <UButton type="submit" size="lg" block :loading="submitting" :disabled="!quote">
          Place order — Cash on delivery
        </UButton>
        <p class="text-center text-xs text-stone-400">
          Pay with cash when your order arrives. No card required.
        </p>
      </form>

      <div class="h-fit space-y-4 rounded-lg border border-stone-200 bg-white p-6">
        <h2 class="text-sm font-medium uppercase tracking-wide text-stone-500">
          Order summary
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
            <span>Subtotal</span>
            <span>{{ formatPrice(cart.subtotal) }}</span>
          </div>
          <div class="flex justify-between">
            <span>Shipping</span>
            <span v-if="quoting">…</span>
            <span v-else-if="quote">
              <template v-if="quote.freeShippingApplied">Free</template>
              <template v-else>{{ formatPrice(quote.shippingFee) }}</template>
            </span>
            <span v-else class="text-stone-400">Enter city</span>
          </div>
          <div class="flex justify-between font-medium text-base pt-2">
            <span>Total</span>
            <span>{{ quote ? formatPrice(quote.total) : formatPrice(cart.subtotal) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
