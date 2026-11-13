<script setup lang="ts">
const { t } = useI18n()
useHead({ title: 'Categories — Atelier Élégance' })

const { data: categoriesRes } = await useAsyncData('all-categories', () => apiFetch<any[]>('/api/categories'))
const categories = computed(() => categoriesRes.value ?? [])
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <h1 class="font-display text-3xl">
      {{ t('categoriesPage.title') }}
    </h1>

    <div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <NuxtLink
        v-for="category in categories"
        :key="category.id"
        :to="`/category/${category.slug}`"
        class="group relative overflow-hidden rounded-md"
      >
        <div class="product-media">
          <img
            v-if="category.imageUrl"
            :src="category.imageUrl"
            :alt="category.name"
            class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          >
          <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
            <UIcon name="i-lucide-shirt" class="size-8" />
          </div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <p class="absolute bottom-3 start-3 font-display text-lg text-white">
            {{ category.name }}
          </p>
        </div>
      </NuxtLink>
    </div>

    <UEmpty v-if="!categories.length" icon="i-lucide-folder-tree" :title="t('categoriesPage.empty')" class="mt-16" />
  </div>
</template>
