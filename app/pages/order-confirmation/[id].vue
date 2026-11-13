<script setup lang="ts">
const { t, locale } = useI18n()
const route = useRoute()
const id = route.params.id as string

const { data, pending, error } = await useAsyncData(`order-${id}`, () => apiFetch(`/api/orders/${id}`))

useHead({ title: 'Order confirmed — Atelier Élégance' })

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
    <div v-if="pending" class="space-y-4">
      <USkeleton class="h-8 w-1/2" />
      <USkeleton class="h-32 w-full" />
    </div>

    <UEmpty v-else-if="error || !data" icon="i-lucide-receipt" :title="t('orderConfirmation.notFound')" class="mt-10" />

    <template v-else>
      <div class="text-center">
        <UIcon name="i-lucide-check-circle-2" class="mx-auto size-12 text-green-600" />
        <h1 class="mt-4 font-display text-3xl">
          {{ t('orderConfirmation.thankYou', { name: data.customerName.split(' ')[0] }) }}
        </h1>
        <p class="mt-2 text-stone-600">
          {{ t('orderConfirmation.orderPlaced', { orderNumber: data.orderNumber }) }}
        </p>
        <p class="mt-1 text-sm text-stone-400">
          {{ t('orderConfirmation.placedOn', { date: formatDate(data.createdAt) }) }}
        </p>
      </div>

      <div class="mt-10 rounded-lg border border-stone-200 bg-white p-6">
        <h2 class="text-sm font-medium uppercase tracking-wide text-stone-500">
          {{ t('orderConfirmation.items') }}
        </h2>
        <ul class="mt-3 divide-y divide-stone-100">
          <li v-for="item in data.items" :key="item.id" class="flex justify-between gap-3 py-3 text-sm">
            <span class="text-stone-600">
              {{ item.productName }}
              <span v-if="item.variantLabel" class="text-stone-400"> ({{ item.variantLabel }})</span>
              × {{ item.quantity }}
            </span>
            <span>{{ formatPrice(item.subtotal) }}</span>
          </li>
        </ul>

        <div class="mt-4 space-y-1 border-t border-stone-200 pt-4 text-sm">
          <div class="flex justify-between">
            <span>{{ t('common.subtotal') }}</span>
            <span>{{ formatPrice(data.subtotal) }}</span>
          </div>
          <div class="flex justify-between">
            <span>{{ t('common.shipping') }}</span>
            <span>{{ data.shippingFee ? formatPrice(data.shippingFee) : t('common.free') }}</span>
          </div>
          <div class="flex justify-between pt-2 text-base font-medium">
            <span>{{ t('common.total') }}</span>
            <span>{{ formatPrice(data.total) }}</span>
          </div>
        </div>
      </div>

      <div class="mt-6 grid gap-6 sm:grid-cols-2">
        <div class="rounded-lg border border-stone-200 bg-white p-6">
          <h2 class="text-sm font-medium uppercase tracking-wide text-stone-500">
            {{ t('orderConfirmation.deliveryTo') }}
          </h2>
          <p class="mt-2 text-sm text-stone-600">
            {{ data.customerName }}<br>
            {{ data.addressLine }}<br>
            {{ data.city }}<br>
            {{ data.customerPhone }}
          </p>
          <p v-if="data.deliveryInstructions" class="mt-2 text-xs text-stone-400">
            {{ data.deliveryInstructions }}
          </p>
        </div>
        <div class="rounded-lg border border-stone-200 bg-white p-6">
          <h2 class="text-sm font-medium uppercase tracking-wide text-stone-500">
            {{ t('orderConfirmation.payment') }}
          </h2>
          <p class="mt-2 text-sm text-stone-600">
            {{ t('orderConfirmation.cashOnDelivery') }}
          </p>
          <UBadge class="mt-2" color="warning" variant="subtle">
            {{ data.paymentStatus === 'unpaid' ? t('orderConfirmation.paymentDueOnDelivery') : data.paymentStatus }}
          </UBadge>
        </div>
      </div>

      <div class="mt-10 text-center">
        <UButton to="/products" variant="soft">
          {{ t('orderConfirmation.continueShopping') }}
        </UButton>
      </div>
    </template>
  </div>
</template>
