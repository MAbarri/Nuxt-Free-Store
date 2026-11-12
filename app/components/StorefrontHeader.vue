<script setup lang="ts">
const { data: settings } = await useAsyncData('store-settings-nav', () => $fetch('/api/store-settings'))
const storeName = computed(() => settings.value?.data?.storeName ?? 'Atelier')

const { cart, refresh: refreshCart } = useCart()
const { wishlist, refresh: refreshWishlist } = useWishlist()
await useAsyncData('cart-init', refreshCart)
await useAsyncData('wishlist-init', refreshWishlist)
</script>

<template>
  <header class="border-b border-stone-200 bg-stone-50/90 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="font-display text-xl tracking-tight">
        {{ storeName }}
      </NuxtLink>

      <nav class="hidden items-center gap-8 text-sm uppercase tracking-wide md:flex">
        <NuxtLink to="/products">Shop</NuxtLink>
        <NuxtLink to="/categories">Categories</NuxtLink>
      </nav>

      <div class="flex items-center gap-4">
        <UChip :text="wishlist.items.length" :show="wishlist.items.length > 0" size="xs">
          <UButton to="/wishlist" icon="i-lucide-heart" variant="ghost" color="neutral" aria-label="Wishlist" />
        </UChip>
        <UChip :text="cart.itemCount" :show="cart.itemCount > 0" size="xs">
          <UButton to="/cart" icon="i-lucide-shopping-bag" variant="ghost" color="neutral" aria-label="Cart" />
        </UChip>
        <UButton to="/account" icon="i-lucide-user" variant="ghost" color="neutral" aria-label="Account" />
      </div>
    </div>
  </header>
</template>
