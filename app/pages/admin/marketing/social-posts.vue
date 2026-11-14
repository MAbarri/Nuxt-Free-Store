<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ProductRow {
  id: string
  name: string
  sku: string
  basePrice: number
}

interface PromptType {
  id: string
  label: string
  category: string
  categoryLabel: string
}

interface GeneratedPost {
  id: string
  caption: string
  hashtags: string[]
  imageUrl: string | null
  productName: string
  cost: number
}

interface SavedPost {
  id: string
  productId: string | null
  productName: string
  imageUrl: string | null
  platform: string
  locale: string
  promptTypeId: string
  promptTypeLabel: string
  extraNotes: string | null
  caption: string
  hashtags: string[]
  cost: number
  createdAt: string
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

const promptTypes = ref<PromptType[]>([])
const promptTypeId = ref<string | null>(null)
const extraNotes = ref('')

// USelectMenu renders an array-of-arrays as separate labeled groups — one
// sub-array per post category, each starting with a non-selectable "label"
// row for the category name, mirroring the wizard's categorized scene picker.
const promptTypeItems = computed(() => {
  const groups = new Map<string, { label: string, items: Array<{ type: 'label' | 'item', label: string, value?: string }> }>()
  for (const type of promptTypes.value) {
    if (!groups.has(type.category)) {
      groups.set(type.category, { label: type.categoryLabel, items: [{ type: 'label', label: type.categoryLabel }] })
    }
    groups.get(type.category)!.items.push({ type: 'item', label: type.label, value: type.id })
  }
  return Array.from(groups.values()).map(g => g.items)
})

async function loadPromptTypes() {
  try {
    promptTypes.value = await apiFetch<PromptType[]>('/api/admin/marketing/social-posts/prompt-types')
    promptTypeId.value = promptTypes.value[0]?.id ?? null
  }
  catch (e) {
    toast.add({ title: 'Failed to load post types', description: apiErrorMessage(e), color: 'error' })
  }
}

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

const savedPosts = ref<SavedPost[]>([])
const loadingSaved = ref(true)
const deletingId = ref<string | null>(null)

async function loadSavedPosts() {
  loadingSaved.value = true
  try {
    savedPosts.value = await apiFetch<SavedPost[]>('/api/admin/marketing/social-posts')
  }
  catch (e) {
    toast.add({ title: 'Failed to load saved posts', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loadingSaved.value = false
  }
}

async function deleteSavedPost(id: string) {
  if (!confirm('Delete this saved post? This cannot be undone.')) return
  deletingId.value = id
  try {
    await apiFetch(`/api/admin/marketing/social-posts/${id}`, { method: 'DELETE' })
    savedPosts.value = savedPosts.value.filter(p => p.id !== id)
    toast.add({ title: 'Post deleted', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Delete failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    deletingId.value = null
  }
}

function platformIcon(platform: string) {
  return PLATFORMS.find(p => p.value === platform)?.icon ?? 'i-lucide-share-2'
}

function localeLabel(locale: string) {
  return LOCALES.find(l => l.value === locale)?.label ?? locale
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

async function generate() {
  if (!selectedProduct.value || !promptTypeId.value) return
  generating.value = true
  try {
    post.value = await apiFetch<GeneratedPost>('/api/admin/marketing/social-posts/generate', {
      method: 'POST',
      body: {
        productId: selectedProduct.value.id,
        platform: platform.value,
        locale: locale.value,
        promptTypeId: promptTypeId.value,
        extraNotes: extraNotes.value.trim() || undefined,
      },
    })
    toast.add({ title: 'Post generated and saved', description: `AI cost: $${post.value.cost.toFixed(4)} — review before posting`, color: 'success' })
    loadSavedPosts()
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

onMounted(loadPromptTypes)
onMounted(loadSavedPosts)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Social media post generator
    </h1>
    <p class="text-sm text-stone-500">
      Pick a product, a post angle, a platform and a language — AI writes a ready-to-post caption and hashtags you can copy straight into Instagram, Facebook, or TikTok. Nothing is auto-published. Every generated post is saved below so you can come back to it later.
    </p>

    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header><p class="font-medium">1. Product &amp; angle</p></template>

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

        <UFormField label="Post angle" description="Categorized, searchable — type to filter." class="mt-4">
          <USelectMenu
            v-model="promptTypeId" value-key="value" label-key="label"
            :items="promptTypeItems" placeholder="Choose a post angle…" class="w-full"
          />
        </UFormField>

        <UFormField label="Extra details (optional)" description="A discount %, an occasion name, etc. — worked in as-is, never invented by the AI." class="mt-4">
          <UInput v-model="extraNotes" placeholder="e.g. 20% off until Sunday" class="w-full" />
        </UFormField>

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
          <UButton class="mt-4" block :loading="generating" :disabled="!selectedProduct || !promptTypeId" icon="i-lucide-sparkles" @click="generate">
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
          <div v-if="post.imageUrl" class="w-32 max-w-full">
            <div class="product-media aspect-square rounded-md">
              <img :src="post.imageUrl" :alt="post.productName" class="h-full w-full object-cover">
            </div>
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

    <UCard class="mt-6">
      <template #header><p class="font-medium">Saved posts</p></template>

      <div v-if="loadingSaved" class="text-sm text-stone-400">Loading…</div>
      <p v-else-if="!savedPosts.length" class="text-sm text-stone-400">
        Generated posts are saved here automatically — nothing yet.
      </p>

      <div v-else class="divide-y divide-stone-100">
        <div v-for="saved in savedPosts" :key="saved.id" class="flex gap-3 py-4 first:pt-0 last:pb-0">
          <div v-if="saved.imageUrl" class="w-16 shrink-0 max-w-full">
            <div class="product-media aspect-square rounded-md">
              <img :src="saved.imageUrl" :alt="saved.productName" class="h-full w-full object-cover">
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <UIcon :name="platformIcon(saved.platform)" class="size-4 text-stone-400" />
              <p class="truncate text-sm font-medium">{{ saved.productName }}</p>
              <UBadge size="xs" variant="soft" color="neutral">{{ saved.promptTypeLabel }}</UBadge>
              <UBadge size="xs" variant="soft" color="neutral">{{ localeLabel(saved.locale) }}</UBadge>
            </div>
            <p class="mt-1 whitespace-pre-line text-sm text-stone-600 line-clamp-3">{{ saved.caption }}</p>
            <p v-if="saved.extraNotes" class="mt-1 text-xs text-stone-400">
              Extra details: {{ saved.extraNotes }}
            </p>
            <p class="mt-1 text-xs text-stone-400">{{ formatDate(saved.createdAt) }} · AI cost ${{ saved.cost.toFixed(4) }}</p>

            <div class="mt-2 flex flex-wrap gap-2">
              <UButton size="xs" variant="soft" icon="i-lucide-copy" @click="copyText(saved.caption, 'Caption')">
                Copy caption
              </UButton>
              <UButton size="xs" variant="soft" icon="i-lucide-copy" @click="copyText(saved.hashtags.map(h => `#${h}`).join(' '), 'Hashtags')">
                Copy hashtags
              </UButton>
              <UButton
                size="xs" variant="soft" color="error" icon="i-lucide-trash-2"
                :loading="deletingId === saved.id"
                @click="deleteSavedPost(saved.id)"
              >
                Delete
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
