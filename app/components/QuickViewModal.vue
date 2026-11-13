<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ slug: string | null }>()

const product = ref<any>(null)
const loading = ref(false)

async function load() {
  if (!props.slug) return
  loading.value = true
  try {
    product.value = await apiFetch(`/api/products/${props.slug}`)
  }
  finally {
    loading.value = false
  }
}

watch([() => props.slug, open], ([, isOpen]) => {
  if (isOpen) load()
})

</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="grid gap-0 sm:grid-cols-2">
        <div class="product-media">
          <img
            v-if="product?.images?.[0]"
            :src="product.images[0].url"
            :alt="product.name"
            class="h-full w-full object-cover"
          >
        </div>
        <div class="p-6">
          <template v-if="loading || !product">
            <USkeleton class="h-6 w-2/3" />
            <USkeleton class="mt-3 h-4 w-1/3" />
          </template>
          <template v-else>
            <h2 class="font-display text-xl">{{ product.name }}</h2>
            <p class="mt-1 text-stone-600">{{ formatPrice(product.basePrice) }}</p>
            <p v-if="product.shortDescription" class="mt-3 text-sm text-stone-600">
              {{ product.shortDescription }}
            </p>
            <UButton class="mt-6" block :to="`/products/${product.slug}`" @click="open = false">
              View full details
            </UButton>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>
