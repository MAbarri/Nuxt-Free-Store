<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ProductRow {
  id: string
  name: string
  sku: string
  basePrice: number
}

interface GeneratedPost {
  caption: string
  hashtags: string[]
  imageUrl: string | null
  productName: string
  cost: number
}

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: 'i-lucide-instagram' },
  { value: 'facebook', label: 'Facebook', icon: 'i-lucide-facebook' },
  { value: 'tiktok', label: 'TikTok', icon: 'i-lucide-music-2' },
] as const
const LOCALES = [
  { value: 'fr', label: 'French' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
] as const

const toast = useToast()

const search = ref('')
const searching = ref(false)
const results = ref<ProductRow[]>([])
const selectedProduct = ref<ProductRow | null>(null)
const platform = ref<typeof PLATFORMS[number]['value']>('instagram')
const locale = ref<typeof LOCALES[number]['value']>('fr')

let searchTimeout: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimeout)
  if (!search.value.trim()) { results.value = []; return }
  searchTimeout = setTimeout(runSearch, 300)
})

async function runSearch() {
  searching.value = true
  try {
    const result = await apiFetch<{ rows: ProductRow[], total: number }>('/api/admin/products', {
      query: { search: search.value, pageSize: 8 },
    })
    results.value = result.rows
  }
  catch (e) {
    toast.add({ title: 'Search failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    searching.value = false
  }
}

function selectProduct(product: ProductRow) {
  selectedProduct.value = product
  results.value = []
  search.value = ''
}

const generating = ref(false)
const post = ref<GeneratedPost | null>(null)

async function generate() {
  if (!selectedProduct.value) return
  generating.value = true
  try {
    post.value = await apiFetch<GeneratedPost>('/api/admin/marketing/social-posts/generate', {
      method: 'POST',
      body: { productId: selectedProduct.value.id, platform: platform.value, locale: locale.value },
    })
    toast.add({ title: 'Post generated', description: `AI cost: $${post.value.cost.toFixed(4)} — review before posting`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Generation failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    generating.value = false
  }
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: `${label} copied`, color: 'success' })
  }
  catch {
    toast.add({ title: 'Could not copy to clipboard', color: 'error' })
  }
}

const hashtagsText = computed(() => post.value ? post.value.hashtags.map(h => `#${h}`).join(' ') : '')
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Social media post generator
    </h1>
    <p class="text-sm text-stone-500">
      Pick a product and a platform — AI writes a ready-to-post caption and hashtags you can copy straight into Instagram, Facebook, or TikTok. Nothing is auto-published.
    </p>

    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header><p class="font-medium">1. Product</p></template>

        <UInput v-model="search" icon="i-lucide-search" placeholder="Search products by name or SKU…" class="w-full" />
        <div v-if="searching" class="mt-2 text-sm text-stone-400">Searching…</div>
        <div v-else-if="results.length" class="mt-2 divide-y divide-stone-100 rounded-md border border-stone-200">
          <button
            v-for="product in results" :key="product.id" type="button"
            class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50"
            @click="selectProduct(product)"
          >
            <span>{{ product.name }}</span>
            <span class="text-stone-400">{{ product.sku }}</span>
          </button>
        </div>

        <div v-if="selectedProduct" class="mt-4 flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
          <div>
            <p class="text-sm font-medium">{{ selectedProduct.name }}</p>
            <p class="text-xs text-stone-500">{{ selectedProduct.sku }} · {{ formatPrice(selectedProduct.basePrice) }}</p>
          </div>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="selectedProduct = null" />
        </div>

        <template #footer>
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField label="Platform">
              <div class="flex gap-2">
                <UButton
                  v-for="p in PLATFORMS" :key="p.value"
                  size="sm" :icon="p.icon"
                  :variant="platform === p.value ? 'solid' : 'soft'"
                  @click="platform = p.value"
                >
                  {{ p.label }}
                </UButton>
              </div>
            </UFormField>
            <UFormField label="Language">
              <div class="flex gap-2">
                <UButton
                  v-for="l in LOCALES" :key="l.value"
                  size="sm"
                  :variant="locale === l.value ? 'solid' : 'soft'"
                  @click="locale = l.value"
                >
                  {{ l.label }}
                </UButton>
              </div>
            </UFormField>
          </div>
          <UButton class="mt-4" block :loading="generating" :disabled="!selectedProduct" icon="i-lucide-sparkles" @click="generate">
            Generate post
          </UButton>
        </template>
      </UCard>

      <UCard>
        <template #header><p class="font-medium">2. Result</p></template>

        <p v-if="!post" class="text-sm text-stone-400">
          Pick a product and generate a post to see it here.
        </p>

        <div v-else class="space-y-4">
          <div v-if="post.imageUrl" class="product-media aspect-square w-32 rounded-md">
            <img :src="post.imageUrl" :alt="post.productName" class="h-full w-full object-cover">
          </div>

          <UFormField label="Caption">
            <UTextarea v-model="post.caption" :rows="8" class="w-full" />
          </UFormField>
          <UButton size="xs" variant="soft" icon="i-lucide-copy" @click="copyText(post.caption, 'Caption')">
            Copy caption
          </UButton>

          <UFormField label="Hashtags">
            <UTextarea v-model="hashtagsText" :rows="3" class="w-full" readonly />
          </UFormField>
          <UButton size="xs" variant="soft" icon="i-lucide-copy" @click="copyText(hashtagsText, 'Hashtags')">
            Copy hashtags
          </UButton>

          <div class="pt-2">
            <UButton size="xs" variant="soft" icon="i-lucide-copy" @click="copyText(`${post.caption}\n\n${hashtagsText}`, 'Caption + hashtags')">
              Copy caption + hashtags together
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
