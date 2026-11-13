<script setup lang="ts">
useHead({ title: 'Your wishlist — Atelier Élégance' })

const { wishlist, refresh, removeItem } = useWishlist()
await useAsyncData('wishlist-page', refresh)

</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <h1 class="font-display text-3xl">
      Your wishlist
    </h1>

    <UEmpty
      v-if="!wishlist.items.length"
      icon="i-lucide-heart"
      title="Your wishlist is empty"
      description="Save items you love to find them here later."
      class="mt-10"
      :actions="[{ label: 'Shop now', to: '/products' }]"
    />

    <div v-else class="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="item in wishlist.items" :key="item.productId" class="group">
        <NuxtLink :to="item.slug ? `/products/${item.slug}` : '#'" class="product-media block rounded-md">
          <img v-if="item.primaryImageUrl" :src="item.primaryImageUrl" :alt="item.name" class="h-full w-full object-cover">
          <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
            <UIcon name="i-lucide-image" class="size-8" />
          </div>
          <span v-if="!item.available" class="absolute left-2 top-2 rounded-full bg-stone-900/80 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white">
            Unavailable
          </span>
        </NuxtLink>
        <div class="mt-3 flex items-start justify-between gap-2">
          <div>
            <NuxtLink v-if="item.slug" :to="`/products/${item.slug}`" class="font-medium hover:underline">
              {{ item.name }}
            </NuxtLink>
            <p v-else class="font-medium text-stone-400">{{ item.name }}</p>
            <p class="mt-1 text-sm text-stone-500">{{ formatPrice(item.basePrice) }}</p>
          </div>
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-heart-off" @click="removeItem(item.productId)" />
        </div>
      </div>
    </div>
  </div>
</template>
