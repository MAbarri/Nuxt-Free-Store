<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Category { id: string, name: string }
interface AttributeValue { id: string, value: string, swatchHex: string | null }
interface Attribute { id: string, name: string, displayType: string, values: AttributeValue[] }
interface ImageScene { id: string, label: string, hasModel: boolean }

interface LocaleContent {
  name: string
  shortDescription: string
  description: string
  seoTitle: string
  seoDescription: string
}
function emptyLocaleContent(): LocaleContent {
  return { name: '', shortDescription: '', description: '', seoTitle: '', seoDescription: '' }
}

const toast = useToast()
const categories = ref<Category[]>([])
const attributes = ref<Attribute[]>([])
const imageScenes = ref<ImageScene[]>([])
const loadingLookups = ref(true)

const colorAttr = computed(() => attributes.value.find(a => ['color', 'colour', 'couleur'].includes(a.name.trim().toLowerCase())))
const sizeAttr = computed(() => attributes.value.find(a => ['size', 'taille', 'pointure'].includes(a.name.trim().toLowerCase())))

async function loadLookups() {
  loadingLookups.value = true
  try {
    const [cats, attrs, scenes] = await Promise.all([
      apiFetch<Category[]>('/api/admin/categories'),
      apiFetch<Attribute[]>('/api/admin/attributes'),
      apiFetch<ImageScene[]>('/api/admin/ai/image-scenes'),
    ])
    categories.value = cats
    attributes.value = attrs
    imageScenes.value = scenes
    // Default selection: everything except the café scene, to keep the
    // default generation close to the previous "4 photos" behavior.
    selectedSceneIds.value = scenes.filter(s => s.id !== 'lifestyle-casablanca-cafe').map(s => s.id)
  }
  catch (e) {
    toast.add({ title: 'Failed to load categories/attributes', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loadingLookups.value = false
  }
}
onMounted(loadLookups)

// --- Step 1: inputs ---
const step = ref<1 | 2 | 3>(1)
const referenceImageDataUrl = ref<string | null>(null)
const referenceFileName = ref('')

function onReferenceFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  referenceFileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    referenceImageDataUrl.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

const inputForm = reactive({
  sku: '',
  basePrice: 0,
  compareAtPrice: null as number | null,
  categoryIds: [] as string[],
})

// --- Photo scenes + optional color/styling modifiers ---
const selectedSceneIds = ref<string[]>([])
const targetColor = ref('')
const stylingNotes = ref('')

function addStylingPreset(text: string) {
  stylingNotes.value = stylingNotes.value.trim() ? `${stylingNotes.value.trim()}, ${text}` : text
}

const selectedColorIds = ref<string[]>([])
const selectedSizeIds = ref<string[]>([])
/** Keyed by `${colorId}:${sizeId}` (or just one id if that attribute isn't configured). */
const stockGrid = reactive<Record<string, number>>({})

// --- Add a new color value on the fly, in case the one needed isn't set up yet ---
const newColorName = ref('')
const newColorHex = ref('#000000')
const addingColor = ref(false)

async function addColor() {
  if (!colorAttr.value || !newColorName.value.trim()) return
  const name = newColorName.value.trim()
  addingColor.value = true
  try {
    const result = await apiFetch<{ id: string }>(`/api/admin/attributes/${colorAttr.value.id}/values`, {
      method: 'POST',
      body: {
        value: name,
        swatchHex: colorAttr.value.displayType === 'swatch' ? newColorHex.value : undefined,
      },
    })
    attributes.value = await apiFetch<Attribute[]>('/api/admin/attributes')
    selectedColorIds.value = [...selectedColorIds.value, result.id]
    newColorName.value = ''
    toast.add({ title: `Added color "${name}"`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to add color', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    addingColor.value = false
  }
}

function comboKey(colorId: string | null, sizeId: string | null) {
  return `${colorId ?? '_'}:${sizeId ?? '_'}`
}

const combos = computed(() => {
  const colors = colorAttr.value ? selectedColorIds.value : [null]
  const sizes = sizeAttr.value ? selectedSizeIds.value : [null]
  if (colorAttr.value && !colors.length) return []
  if (sizeAttr.value && !sizes.length) return []
  const result: Array<{ colorId: string | null, sizeId: string | null, key: string }> = []
  for (const colorId of colors) {
    for (const sizeId of sizes) {
      result.push({ colorId, sizeId, key: comboKey(colorId, sizeId) })
    }
  }
  return result
})

watch(combos, (list) => {
  for (const combo of list) {
    if (!(combo.key in stockGrid)) stockGrid[combo.key] = 0
  }
}, { immediate: true })

function colorLabel(id: string | null) {
  return colorAttr.value?.values.find(v => v.id === id)?.value
}
function sizeLabel(id: string | null) {
  return sizeAttr.value?.values.find(v => v.id === id)?.value
}

const canGenerate = computed(() =>
  !!referenceImageDataUrl.value
  && inputForm.sku.trim().length > 0
  && inputForm.basePrice > 0
  && combos.value.length > 0
  && selectedSceneIds.value.length > 0,
)

// --- Step 2: generation ---
const generating = ref(false)
const generatingLabel = ref('')
const generationCost = ref(0)

interface ReviewImage { dataUrl: string, kept: boolean, regenerating: boolean, sceneId: string }
const review = reactive({
  fr: emptyLocaleContent(),
  en: emptyLocaleContent(),
  ar: emptyLocaleContent(),
  images: [] as ReviewImage[],
  includeReference: true,
})
const activeReviewLocale = ref<'fr' | 'en' | 'ar'>('fr')

async function generate() {
  if (!referenceImageDataUrl.value) return
  generating.value = true
  generationCost.value = 0
  try {
    generatingLabel.value = 'Writing product copy (French, then English/Arabic)…'
    const copy = await apiFetch<{ fr: LocaleContent, en: LocaleContent | null, ar: LocaleContent | null, cost: number }>(
      '/api/admin/ai/product-copy',
      {
        method: 'POST',
        body: {
          imageDataUrl: referenceImageDataUrl.value,
          colors: selectedColorIds.value.map(id => colorLabel(id)).filter(Boolean),
          sizes: selectedSizeIds.value.map(id => sizeLabel(id)).filter(Boolean),
          price: Math.round(inputForm.basePrice * 100),
          categoryName: categories.value.find(c => inputForm.categoryIds.includes(c.id))?.name,
        },
      },
    )
    generationCost.value += copy.cost
    review.fr = { ...copy.fr }
    review.en = copy.en ? { ...copy.en } : emptyLocaleContent()
    review.ar = copy.ar ? { ...copy.ar } : emptyLocaleContent()

    generatingLabel.value = `Generating ${selectedSceneIds.value.length} product photo${selectedSceneIds.value.length > 1 ? 's' : ''} — this can take up to a minute…`
    const imagesResult = await apiFetch<{ images: Array<{ dataUrl: string, sceneId: string }>, cost: number }>(
      '/api/admin/ai/product-images',
      {
        method: 'POST',
        body: {
          imageDataUrl: referenceImageDataUrl.value,
          sceneIds: selectedSceneIds.value,
          color: targetColor.value.trim() || undefined,
          stylingNotes: stylingNotes.value.trim() || undefined,
        },
      },
    )
    generationCost.value += imagesResult.cost
    review.images = imagesResult.images.map(img => ({ dataUrl: img.dataUrl, kept: true, regenerating: false, sceneId: img.sceneId }))
    review.includeReference = true

    step.value = 3
  }
  catch (e) {
    toast.add({ title: 'Generation failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    generating.value = false
    generatingLabel.value = ''
  }
}

async function regenerateImage(image: ReviewImage) {
  if (!referenceImageDataUrl.value) return
  image.regenerating = true
  try {
    const result = await apiFetch<{ images: Array<{ dataUrl: string, sceneId: string }>, cost: number }>(
      '/api/admin/ai/product-images',
      {
        method: 'POST',
        body: {
          imageDataUrl: referenceImageDataUrl.value,
          sceneIds: [image.sceneId],
          color: targetColor.value.trim() || undefined,
          stylingNotes: stylingNotes.value.trim() || undefined,
        },
      },
    )
    generationCost.value += result.cost
    if (result.images[0]) image.dataUrl = result.images[0].dataUrl
  }
  catch (e) {
    toast.add({ title: 'Regeneration failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    image.regenerating = false
  }
}

function removeImage(image: ReviewImage) {
  review.images = review.images.filter(i => i !== image)
}

// --- Step 3: confirm & create ---
const creating = ref(false)

function cleanLocale(content: LocaleContent): Record<string, string | null> | null {
  const hasAny = Object.values(content).some(v => v.trim())
  if (!hasAny) return null
  return {
    name: content.name.trim() || null,
    shortDescription: content.shortDescription.trim() || null,
    description: content.description.trim() || null,
    seoTitle: content.seoTitle.trim() || null,
    seoDescription: content.seoDescription.trim() || null,
  }
}

async function createProduct() {
  if (!referenceImageDataUrl.value) return
  creating.value = true
  try {
    const variants = combos.value.map((combo) => {
      const codes = [colorLabel(combo.colorId), sizeLabel(combo.sizeId)].filter(Boolean)
        .map(l => l!.slice(0, 3).toUpperCase())
      const sku = [inputForm.sku, ...codes].join('-')
      const attributeValueIds = [combo.colorId, combo.sizeId].filter((v): v is string => !!v)
      return { sku, stock: stockGrid[combo.key] ?? 0, attributeValueIds }
    })

    const translations: Record<string, unknown> = {
      fr: {
        name: review.fr.name.trim(),
        shortDescription: review.fr.shortDescription.trim() || null,
        description: review.fr.description.trim() || null,
        seoTitle: review.fr.seoTitle.trim() || null,
        seoDescription: review.fr.seoDescription.trim() || null,
      },
    }
    const en = cleanLocale(review.en)
    const ar = cleanLocale(review.ar)
    if (en) translations.en = en
    if (ar) translations.ar = ar

    const product = await apiFetch<{ id: string }>('/api/admin/ai/products', {
      method: 'POST',
      body: {
        sku: inputForm.sku,
        basePrice: Math.round(inputForm.basePrice * 100),
        compareAtPrice: inputForm.compareAtPrice ? Math.round(inputForm.compareAtPrice * 100) : null,
        categoryIds: inputForm.categoryIds,
        referenceImageDataUrl: referenceImageDataUrl.value,
        includeReferenceImage: review.includeReference,
        generatedImageDataUrls: review.images.filter(i => i.kept).map(i => i.dataUrl),
        translations,
        variants,
      },
    })

    toast.add({ title: 'Product created', color: 'success' })
    await navigateTo(`/admin/products/${product.id}`)
  }
  catch (e) {
    toast.add({ title: 'Failed to create product', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl">
          Create product with AI
        </h1>
        <p class="text-sm text-stone-500">
          Upload one reference photo — AI writes the name, description, and SEO copy (in French,
          English and Arabic), and generates extra carousel photos. Nothing is saved until you confirm.
        </p>
      </div>
      <UButton variant="ghost" to="/admin/products">
        Cancel
      </UButton>
    </div>

    <!-- Step 1: inputs -->
    <div v-if="step === 1" class="mt-6 grid gap-6 lg:grid-cols-3">
      <UCard class="lg:col-span-2">
        <template #header><p class="font-medium">Product basics</p></template>
        <div class="space-y-4">
          <UFormField label="Reference photo">
            <div class="max-w-xs space-y-3">
              <div class="product-media aspect-[3/4] rounded-md">
                <img v-if="referenceImageDataUrl" :src="referenceImageDataUrl" alt="" class="h-full w-full object-cover">
                <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
                  <UIcon name="i-lucide-image" class="size-8" />
                </div>
              </div>
              <div>
                <input type="file" accept="image/*" class="text-sm" @change="onReferenceFileSelected">
                <p class="mt-1 text-xs text-stone-400">One clear photo of the product, ideally on a plain background.</p>
              </div>
            </div>
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="SKU"><UInput v-model="inputForm.sku" required class="w-full" /></UFormField>
            <UFormField label="Base price (DH)"><UInputNumber v-model="inputForm.basePrice" :min="0" :step="10" class="w-full" /></UFormField>
            <UFormField label="Compare-at price (DH, optional)"><UInputNumber v-model="inputForm.compareAtPrice" :min="0" :step="10" class="w-full" /></UFormField>
          </div>

          <UFormField label="Categories">
            <div class="flex flex-wrap gap-3">
              <UCheckbox
                v-for="cat in categories" :key="cat.id"
                :model-value="inputForm.categoryIds.includes(cat.id)" :label="cat.name"
                @update:model-value="(v) => inputForm.categoryIds = v ? [...inputForm.categoryIds, cat.id] : inputForm.categoryIds.filter(id => id !== cat.id)"
              />
            </div>
          </UFormField>

          <UFormField label="Photos to generate">
            <div class="flex flex-wrap gap-3">
              <UCheckbox
                v-for="scene in imageScenes" :key="scene.id"
                :model-value="selectedSceneIds.includes(scene.id)" :label="scene.label"
                @update:model-value="(v) => selectedSceneIds = v ? [...selectedSceneIds, scene.id] : selectedSceneIds.filter(id => id !== scene.id)"
              />
            </div>
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Target color (optional)" description="e.g. &quot;emerald green&quot; — recolors the garment. Leave empty to keep the reference photo's color.">
              <UInput v-model="targetColor" placeholder="e.g. emerald green" class="w-full" />
            </UFormField>
            <UFormField label="Model styling notes (optional)">
              <UInput v-model="stylingNotes" placeholder="e.g. wearing a hijab" class="w-full" />
              <UButton size="xs" variant="soft" class="mt-2" @click="addStylingPreset('wearing a neatly styled hijab that complements the outfit')">
                + Hijab
              </UButton>
            </UFormField>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header><p class="font-medium">Colors, sizes & stock</p></template>

        <div v-if="!loadingLookups && (!colorAttr || !sizeAttr)" class="text-sm text-amber-700">
          This store needs "Color" and "Size" attributes configured before using the wizard.
          <NuxtLink to="/admin/attributes" class="underline">Set them up in Attributes</NuxtLink>.
        </div>

        <template v-else>
          <UFormField v-if="colorAttr" label="Colors available">
            <div class="flex flex-wrap gap-3">
              <UCheckbox
                v-for="v in colorAttr.values" :key="v.id"
                :model-value="selectedColorIds.includes(v.id)" :label="v.value"
                @update:model-value="(sel) => selectedColorIds = sel ? [...selectedColorIds, v.id] : selectedColorIds.filter(id => id !== v.id)"
              />
            </div>

            <div class="mt-3 flex flex-wrap items-end gap-2">
              <UInput v-model="newColorName" placeholder="New color name" size="sm" @keyup.enter="addColor" />
              <input
                v-if="colorAttr.displayType === 'swatch'"
                v-model="newColorHex"
                type="color"
                class="h-8 w-10 rounded border border-stone-200"
              >
              <UButton
                size="sm" variant="soft" icon="i-lucide-plus"
                :loading="addingColor" :disabled="!newColorName.trim()"
                @click="addColor"
              >
                Add color
              </UButton>
            </div>
          </UFormField>

          <UFormField v-if="sizeAttr" label="Sizes available" class="mt-4">
            <div class="flex flex-wrap gap-3">
              <UCheckbox
                v-for="v in sizeAttr.values" :key="v.id"
                :model-value="selectedSizeIds.includes(v.id)" :label="v.value"
                @update:model-value="(sel) => selectedSizeIds = sel ? [...selectedSizeIds, v.id] : selectedSizeIds.filter(id => id !== v.id)"
              />
            </div>
          </UFormField>

          <div v-if="combos.length" class="mt-4">
            <p class="text-sm font-medium">Stock per variant</p>
            <table class="mt-2 w-full text-sm">
              <tbody>
                <tr v-for="combo in combos" :key="combo.key" class="border-t border-stone-100">
                  <td class="py-2 text-stone-600">
                    {{ [colorLabel(combo.colorId), sizeLabel(combo.sizeId)].filter(Boolean).join(' / ') }}
                  </td>
                  <td class="py-2 w-28">
                    <UInputNumber v-model="stockGrid[combo.key]" :min="0" size="xs" class="w-full" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </UCard>
    </div>

    <div v-if="step === 1" class="mt-6 flex justify-end">
      <UButton size="lg" icon="i-lucide-sparkles" :disabled="!canGenerate" :loading="generating" @click="generate">
        Generate with AI
      </UButton>
    </div>

    <!-- Step 2: generating -->
    <UCard v-if="generating" class="mt-6">
      <div class="flex items-center gap-3 py-6">
        <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
        <p class="text-sm text-stone-600">{{ generatingLabel }}</p>
      </div>
    </UCard>

    <!-- Step 3: review -->
    <div v-if="step === 3 && !generating" class="mt-6 space-y-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <p class="font-medium">Review content</p>
            <p class="text-sm text-stone-500">AI cost so far: ${{ generationCost.toFixed(4) }}</p>
          </div>
        </template>

        <div class="flex gap-2">
          <UButton
            v-for="locale in (['fr', 'en', 'ar'] as const)" :key="locale"
            size="xs" :variant="activeReviewLocale === locale ? 'solid' : 'soft'"
            @click="activeReviewLocale = locale"
          >
            {{ { fr: 'French', en: 'English', ar: 'Arabic' }[locale] }}
          </UButton>
        </div>

        <div class="mt-4 space-y-4">
          <UFormField label="Name"><UInput v-model="review[activeReviewLocale].name" class="w-full" /></UFormField>
          <UFormField label="Short description"><UTextarea v-model="review[activeReviewLocale].shortDescription" class="w-full" /></UFormField>
          <UFormField label="Description"><UTextarea v-model="review[activeReviewLocale].description" :rows="5" class="w-full" /></UFormField>
          <UFormField label="SEO title"><UInput v-model="review[activeReviewLocale].seoTitle" class="w-full" /></UFormField>
          <UFormField label="SEO description"><UTextarea v-model="review[activeReviewLocale].seoDescription" class="w-full" /></UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header><p class="font-medium">Photos</p></template>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div class="product-media aspect-[3/4] rounded-md">
              <img :src="referenceImageDataUrl!" alt="" class="h-full w-full object-cover">
            </div>
            <UCheckbox v-model="review.includeReference" label="Use as cover photo" class="mt-2" />
          </div>

          <div v-for="image in review.images" :key="image.sceneId">
            <div class="product-media relative aspect-[3/4] rounded-md">
              <img :src="image.dataUrl" alt="" class="h-full w-full object-cover">
              <div v-if="image.regenerating" class="absolute inset-0 flex items-center justify-center bg-white/70">
                <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
              </div>
            </div>
            <p class="mt-1 text-center text-xs text-stone-400">{{ imageScenes.find(s => s.id === image.sceneId)?.label }}</p>
            <div class="mt-2 flex justify-center gap-1">
              <UButton size="xs" variant="soft" icon="i-lucide-refresh-cw" :disabled="image.regenerating" @click="regenerateImage(image)" />
              <UButton size="xs" variant="soft" color="error" icon="i-lucide-trash-2" @click="removeImage(image)" />
            </div>
          </div>
        </div>
      </UCard>

      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="step = 1">
          Back
        </UButton>
        <UButton size="lg" :loading="creating" @click="createProduct">
          Create product
        </UButton>
      </div>
    </div>
  </div>
</template>
