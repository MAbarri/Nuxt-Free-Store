<script setup lang="ts">
const { data: settings } = await useAsyncData('store-settings-nav', () => apiFetch<any>('/api/store-settings'))
const storeName = computed(() => settings.value?.storeName ?? 'Atelier Élégance')
const announcementBar = computed(() => settings.value?.announcementBar)

const { cart, refresh: refreshCart } = useCart()
await useAsyncData('cart-init', refreshCart)
</script>

<template>
  <div>
    <div v-if="announcementBar" class="bg-stone-900 px-4 py-2 text-center text-[11px] uppercase tracking-[0.13em] text-white">
      {{ announcementBar }}
    </div>

    <header class="border-b border-stone-200 bg-stone-50/90 backdrop-blur">
      <div class="mx-auto grid max-w-7xl grid-cols-2 items-center gap-6 px-4 py-5 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <nav class="hidden items-center gap-6 text-xs uppercase tracking-wide text-stone-600 md:flex">
          <NuxtLink to="/" class="hover:text-stone-900">Home</NuxtLink>
          <NuxtLink to="/products" class="hover:text-stone-900">Shop</NuxtLink>
          <NuxtLink to="/categories" class="hover:text-stone-900">Categories</NuxtLink>
        </nav>

        <NuxtLink
          to="/"
          class="justify-self-start font-display text-xl uppercase tracking-[0.22em] md:justify-self-center"
        >
          {{ storeName }}
        </NuxtLink>

        <div class="flex items-center justify-end gap-4 text-xs text-stone-500">
          <span class="hidden sm:inline">Maroc</span>
          <UChip :text="cart.itemCount" :show="cart.itemCount > 0" size="xs">
            <UButton to="/cart" icon="i-lucide-shopping-bag" variant="ghost" color="neutral" aria-label="Cart" />
          </UChip>
        </div>
      </div>
    </header>
  </div>
</template>
