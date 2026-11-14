<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ProductRow {
  id: string
  name: string
  sku: string
  basePrice: number
}

interface ProductImageRow {
  id: string
  url: string
}

interface Category {
  id: string
  name: string
  parentId: string | null
}

interface CategoryNode extends Category {
  children: CategoryNode[]
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
  imageInstructions: string | null
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

const ALL_PRODUCTS_KEY = '__all__'

const toast = useToast()

// --- Category → products → images browser ---------------------------------
const categories = ref<Category[]>([])
const categoryTree = computed<CategoryNode[]>(() => {
  const byId = new Map<string, CategoryNode>(categories.value.map(c => [c.id, { ...c, children: [] }]))
  const roots: CategoryNode[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node)
    else roots.push(node)
  }
  return roots
})

const expandedCategoryIds = ref(new Set<string>())
const categoryProducts = reactive<Record<string, ProductRow[]>>({})
const categoryProductsLoading = reactive<Record<string, boolean>>({})
const allProductsExpanded = ref(false)

async function loadCategories() {
  try {
    categories.value = await apiFetch<Category[]>('/api/admin/categories')
  }
  catch (e) {
    toast.add({ title: 'Failed to load categories', description: apiErrorMessage(e), color: 'error' })
  }
}

async function loadProductsFor(key: string, categoryId: string | null) {
  if (categoryProducts[key]) return
  categoryProductsLoading[key] = true
  try {
    const query: Record<string, unknown> = { pageSize: 100 }
    if (categoryId) query.categoryId = categoryId
    const result = await apiFetch<{ rows: ProductRow[], total: number }>('/api/admin/products', { query })
    categoryProducts[key] = result.rows
  }
  catch (e) {
    toast.add({ title: 'Failed to load products', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    categoryProductsLoading[key] = false
  }
}

function toggleCategory(id: string) {
  if (expandedCategoryIds.value.has(id)) {
    expandedCategoryIds.value.delete(id)
  }
  else {
    expandedCategoryIds.value.add(id)
    loadProductsFor(id, id)
  }
  // Trigger reactivity — Set mutations aren't tracked in-place by Vue.
  expandedCategoryIds.value = new Set(expandedCategoryIds.value)
}

function toggleAllProducts() {
  allProductsExpanded.value = !allProductsExpanded.value
  if (allProductsExpanded.value) loadProductsFor(ALL_PRODUCTS_KEY, null)
}

const selectedProduct = ref<ProductRow | null>(null)
const productImageCache = reactive<Record<string, ProductImageRow[]>>({})
const loadingProductImages = ref(false)
const selectedImages = ref<ProductImageRow[]>([])

async function selectProductFromTree(product: ProductRow) {
  selectedProduct.value = product
  selectedImages.value = []
  if (!productImageCache[product.id]) {
    loadingProductImages.value = true
    try {
      const full = await apiFetch<{ images: ProductImageRow[] }>(`/api/admin/products/${product.id}`)
      productImageCache[product.id] = full.images
    }
    catch (e) {
      toast.add({ title: 'Failed to load product photos', description: apiErrorMessage(e), color: 'error' })
      productImageCache[product.id] = []
    }
    finally {
      loadingProductImages.value = false
    }
  }
}

const availableImages = computed(() => selectedProduct.value ? (productImageCache[selectedProduct.value.id] ?? []) : [])

function isImageSelected(image: ProductImageRow) {
  return selectedImages.value.some(i => i.id === image.id)
}

function toggleImage(image: ProductImageRow) {
  if (isImageSelected(image)) {
    selectedImages.value = selectedImages.value.filter(i => i.id !== image.id)
  }
  else if (selectedImages.value.length < 3) {
    selectedImages.value = [...selectedImages.value, image]
  }
}

function clearSelectedProduct() {
  selectedProduct.value = null
  selectedImages.value = []
}

provide('socialPostTree', {
  isCategoryExpanded: (id: string) => expandedCategoryIds.value.has(id),
  isCategoryLoading: (id: string) => !!categoryProductsLoading[id],
  productsForCategory: (id: string) => categoryProducts[id] ?? [],
  toggleCategory,
  isProductSelected: (id: string) => selectedProduct.value?.id === id,
  selectProduct: selectProductFromTree,
})

// --- Post angle / platform / language --------------------------------------
const platform = ref<typeof PLATFORMS[number]['value']>('instagram')
const locale = ref<typeof LOCALES[number]['value']>('fr')

const promptTypes = ref<PromptType[]>([])
const promptTypeId = ref<string | null>(null)
const extraNotes = ref('')
const imageInstructions = ref('')

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

const canGenerate = computed(() => !!selectedProduct.value && !!promptTypeId.value && selectedImages.value.length > 0)

async function generate() {
  if (!canGenerate.value) return
  generating.value = true
  try {
    post.value = await apiFetch<GeneratedPost>('/api/admin/marketing/social-posts/generate', {
      method: 'POST',
      body: {
        productId: selectedProduct.value!.id,
        platform: platform.value,
        locale: locale.value,
        promptTypeId: promptTypeId.value,
        extraNotes: extraNotes.value.trim() || undefined,
        referenceImageUrls: selectedImages.value.map(i => i.url),
        imageInstructions: imageInstructions.value.trim() || undefined,
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
onMounted(loadCategories)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Social media post generator
    </h1>
    <p class="text-sm text-stone-500">
      Browse to a product, pick up to 3 of its photos, a post angle, a platform and a language — AI writes a ready-to-post caption and generates a matching photo you can copy straight into Instagram, Facebook, or TikTok. Nothing is auto-published. Every generated post is saved below so you can come back to it later.
    </p>

    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header><p class="font-medium">1. Product, photos &amp; angle</p></template>

        <p class="text-sm font-medium">Browse products</p>
        <div class="mt-2 max-h-64 overflow-y-auto rounded-md border border-stone-200">
          <button
            type="button"
            class="flex w-full items-center gap-1.5 py-1.5 pr-2 pl-2 text-sm hover:bg-stone-50"
            @click="toggleAllProducts"
          >
            <UIcon :name="allProductsExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4 shrink-0 text-stone-400" />
            <UIcon name="i-lucide-layout-grid" class="size-4 shrink-0 text-stone-400" />
            <span class="font-medium">All products</span>
          </button>
          <div v-if="allProductsExpanded">
            <div v-if="categoryProductsLoading[ALL_PRODUCTS_KEY]" class="py-1 pl-8 text-xs text-stone-400">
              Loading…
            </div>
            <button
              v-for="product in categoryProducts[ALL_PRODUCTS_KEY] ?? []" :key="product.id"
              type="button"
              class="flex w-full items-center justify-between gap-2 py-1.5 pr-2 pl-8 text-sm hover:bg-stone-50"
              :class="selectedProduct?.id === product.id ? 'bg-primary-50 text-primary-700' : ''"
              @click="selectProductFromTree(product)"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <UIcon name="i-lucide-shirt" class="size-4 shrink-0 text-stone-400" />
                <span class="truncate">{{ product.name }}</span>
              </span>
              <span class="shrink-0 text-xs text-stone-400">{{ product.sku }}</span>
            </button>
          </div>

          <AdminCategoryTreeNode
            v-for="node in categoryTree" :key="node.id"
            :node="node"
          />
        </div>

        <div v-if="selectedProduct" class="mt-4 flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
          <div>
            <p class="text-sm font-medium">{{ selectedProduct.name }}</p>
            <p class="text-xs text-stone-500">{{ selectedProduct.sku }} · {{ formatPrice(selectedProduct.basePrice) }}</p>
          </div>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="clearSelectedProduct" />
        </div>

        <UFormField
          v-if="selectedProduct"
          label="Input photos" description="Pick up to 3 — fed to the AI as the exact garment(s) to feature in the generated image."
          class="mt-4"
        >
          <div v-if="loadingProductImages" class="text-sm text-stone-400">Loading photos…</div>
          <p v-else-if="!availableImages.length" class="text-sm text-stone-400">This product has no photos yet.</p>
          <div v-else class="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-5">
            <button
              v-for="image in availableImages" :key="image.id"
              type="button"
              class="product-media relative aspect-square rounded-md ring-2 disabled:opacity-40"
              :class="isImageSelected(image) ? 'ring-primary-500' : 'ring-transparent'"
              :disabled="!isImageSelected(image) && selectedImages.length >= 3"
              @click="toggleImage(image)"
            >
              <img :src="image.url" alt="" class="h-full w-full rounded-md object-cover">
              <span
                v-if="isImageSelected(image)"
                class="bg-primary-500 absolute top-1 right-1 flex size-5 items-center justify-center rounded-full text-white"
              >
                <UIcon name="i-lucide-check" class="size-3" />
              </span>
            </button>
          </div>
          <p class="mt-1 text-xs text-stone-400">{{ selectedImages.length }}/3 selected</p>
        </UFormField>

        <UFormField label="Post angle" description="Categorized, searchable — type to filter." class="mt-4">
          <USelectMenu
            v-model="promptTypeId" value-key="value" label-key="label"
            :items="promptTypeItems" placeholder="Choose a post angle…" class="w-full"
          />
        </UFormField>

        <UFormField label="Extra details (optional)" description="A discount %, an occasion name, etc. — worked into the caption as-is, never invented by the AI." class="mt-4">
          <UInput v-model="extraNotes" placeholder="e.g. 20% off until Sunday" class="w-full" />
        </UFormField>

        <UFormField label="Image instructions (optional)" description="Direct the generated photo specifically — a setting, a pose, a background, etc." class="mt-4">
          <UTextarea v-model="imageInstructions" :rows="2" placeholder="e.g. place it on a mannequin against a plain beige background" class="w-full" />
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
          <UButton class="mt-4" block :loading="generating" :disabled="!canGenerate" icon="i-lucide-sparkles" @click="generate">
            Generate post
          </UButton>
        </template>
      </UCard>

      <UCard>
        <template #header><p class="font-medium">2. Result</p></template>

        <p v-if="!post" class="text-sm text-stone-400">
          Pick a product, its input photos, and generate a post to see it here.
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
            <p v-if="saved.imageInstructions" class="mt-1 text-xs text-stone-400">
              Image instructions: {{ saved.imageInstructions }}
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
