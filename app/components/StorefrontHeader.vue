<script setup lang="ts">
const { data: settings } = await useAsyncData('store-settings-nav', () => $fetch('/api/store-settings'))

const storeName = computed(() => settings.value?.data?.storeName ?? 'Atelier')
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
        <UButton to="/wishlist" icon="i-lucide-heart" variant="ghost" color="neutral" aria-label="Wishlist" />
        <UButton to="/cart" icon="i-lucide-shopping-bag" variant="ghost" color="neutral" aria-label="Cart" />
        <UButton to="/account" icon="i-lucide-user" variant="ghost" color="neutral" aria-label="Account" />
      </div>
    </div>
  </header>
</template>
