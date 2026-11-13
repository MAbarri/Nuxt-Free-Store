<script setup lang="ts">
useHead({ title: 'Your cart — Atelier' })

const { cart, refresh, updateQuantity, removeItem } = useCart()
await useAsyncData('cart-page', refresh)

const updating = ref<string | null>(null)
async function changeQuantity(itemId: string, quantity: number) {
  updating.value = itemId
  try {
    await updateQuantity(itemId, quantity)
  }
  finally {
    updating.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
    <h1 class="font-display text-3xl">
      Your cart
    </h1>

    <UEmpty
      v-if="!cart.items.length"
      icon="i-lucide-shopping-bag"
      title="Your cart is empty"
      description="Browse the collection to find something you'll love."
      class="mt-10"
      :actions="[{ label: 'Shop now', to: '/products' }]"
    />

    <div v-else class="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
      <ul class="divide-y divide-stone-200">
        <li v-for="item in cart.items" :key="item.id" class="flex gap-4 py-5">
          <div class="size-24 shrink-0 overflow-hidden rounded-md bg-stone-100">
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.productName" class="h-full w-full object-cover">
          </div>
          <div class="flex grow flex-col">
            <div class="flex items-start justify-between">
              <div>
                <NuxtLink v-if="item.productSlug" :to="`/products/${item.productSlug}`" class="font-medium hover:underline">
                  {{ item.productName }}
                </NuxtLink>
                <p v-else class="font-medium text-stone-400">{{ item.productName }}</p>
                <p class="text-xs text-stone-400">SKU: {{ item.sku }}</p>
              </div>
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeItem(item.id)" />
            </div>

            <p v-if="!item.available" class="mt-1 text-sm text-red-600">
              No longer available — please remove this item.
            </p>
            <p v-else-if="item.exceedsStock" class="mt-1 text-sm text-amber-600">
              Only {{ item.stock }} left in stock.
            </p>

            <div class="mt-auto flex items-center justify-between pt-2">
              <UInputNumber
                :model-value="item.quantity"
                :min="1"
                :max="item.stock"
                :disabled="!item.available || updating === item.id"
                size="sm"
                class="w-24"
                @update:model-value="(v) => changeQuantity(item.id, v)"
              />
              <p class="font-medium">{{ formatPrice(item.subtotal) }}</p>
            </div>
          </div>
        </li>
      </ul>

      <div class="h-fit rounded-lg border border-stone-200 bg-white p-6">
        <div class="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{{ formatPrice(cart.subtotal) }}</span>
        </div>
        <p class="mt-1 text-xs text-stone-400">
          Shipping is calculated at checkout.
        </p>
        <UButton to="/checkout" block size="lg" class="mt-6">
          Proceed to checkout
        </UButton>
      </div>
    </div>
  </div>
</template>
