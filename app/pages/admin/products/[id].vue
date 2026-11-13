<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const productId = route.params.id as string

interface VariantAttr {
  attributeId: string
  attributeName: string
  displayType: string
  valueId: string
  value: string
  swatchHex: string | null
}
interface Variant {
  id: string
  sku: string
  price: number | null
  stock: number
  imageUrl: string | null
  isActive: boolean
  attributes: VariantAttr[]
}
interface ProductImage { id: string, url: string, altText: string | null }
interface LandingBenefit { icon?: string, text: string }
interface LandingBlock { imageUrl: string, caption?: string }
interface TranslationFields {
  name: string | null
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  landingBenefits: LandingBenefit[] | null
  landingBlockCaptions: Array<string | null> | null
}
interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  shortDescription: string | null
  sku: string
  basePrice: number
  compareAtPrice: number | null
  status: 'draft' | 'active' | 'archived'
  isFeatured: boolean
  seoTitle: string | null
  seoDescription: string | null
  sizeGuideId: string | null
  categoryIds: string[]
  images: ProductImage[]
  variants: Variant[]
  layoutStyle: 'standard' | 'landing'
  landingBenefits: LandingBenefit[] | null
  landingBlocks: LandingBlock[] | null
  translations: Partial<Record<'en' | 'ar', TranslationFields>>
}
interface Category { id: string, name: string }
interface AttributeValue { id: string, value: string, swatchHex: string | null }
interface Attribute { id: string, name: string, displayType: string, values: AttributeValue[] }
interface SizeGuide { id: string, title: string }

const product = ref<Product | null>(null)
const categories = ref<Category[]>([])
const attributes = ref<Attribute[]>([])
const sizeGuides = ref<SizeGuide[]>([])
const loading = ref(true)
const saving = ref(false)

const form = reactive({
  name: '', description: '', shortDescription: '', sku: '',
  basePrice: 0, compareAtPrice: null as number | null,
  status: 'draft' as Product['status'], isFeatured: false,
  seoTitle: '', seoDescription: '', sizeGuideId: '', categoryIds: [] as string[],
  layoutStyle: 'standard' as Product['layoutStyle'],
  landingBenefits: [] as LandingBenefit[],
  landingBlocks: [] as LandingBlock[],
})

// USelect can't have an item with value: '' (reserved for "no selection"),
// so "None" uses a 'none' sentinel here and is translated back to '' on the form.
const sizeGuideSelectValue = computed({
  get: () => form.sizeGuideId || 'none',
  set: (v: string) => { form.sizeGuideId = v === 'none' ? '' : v },
})

// --- Translations (English/Arabic — French is the form above) ---
type TranslatableLocale = 'en' | 'ar'
const LOCALE_LABELS: Record<TranslatableLocale, string> = { en: 'English', ar: 'Arabic' }
const activeLocale = ref<TranslatableLocale>('en')
const translating = ref<TranslatableLocale | null>(null)
const savingTranslation = ref<TranslatableLocale | null>(null)

interface TranslationForm {
  name: string
  shortDescription: string
  description: string
  seoTitle: string
  seoDescription: string
  landingBenefits: LandingBenefit[]
  landingBlockCaptions: string[]
}
function emptyTranslationForm(): TranslationForm {
  return { name: '', shortDescription: '', description: '', seoTitle: '', seoDescription: '', landingBenefits: [], landingBlockCaptions: [] }
}
const translationForms = reactive<Record<TranslatableLocale, TranslationForm>>({
  en: emptyTranslationForm(),
  ar: emptyTranslationForm(),
})

function applyTranslationToForm(locale: TranslatableLocale, t: TranslationFields | undefined) {
  translationForms[locale] = {
    name: t?.name ?? '',
    shortDescription: t?.shortDescription ?? '',
    description: t?.description ?? '',
    seoTitle: t?.seoTitle ?? '',
    seoDescription: t?.seoDescription ?? '',
    landingBenefits: t?.landingBenefits ? t.landingBenefits.map(b => ({ ...b })) : [],
    landingBlockCaptions: t?.landingBlockCaptions ? t.landingBlockCaptions.map(c => c ?? '') : [],
  }
}

async function load() {
  loading.value = true
  try {
    const [p, cats, attrs, guides] = await Promise.all([
      apiFetch<Product>(`/api/admin/products/${productId}`),
      apiFetch<Category[]>('/api/admin/categories'),
      apiFetch<Attribute[]>('/api/admin/attributes'),
      apiFetch<SizeGuide[]>('/api/admin/size-guides'),
    ])
    product.value = p
    categories.value = cats
    attributes.value = attrs
    sizeGuides.value = guides

    form.name = p.name
    form.description = p.description ?? ''
    form.shortDescription = p.shortDescription ?? ''
    form.sku = p.sku
    form.basePrice = p.basePrice / 100
    form.compareAtPrice = p.compareAtPrice ? p.compareAtPrice / 100 : null
    form.status = p.status
    form.isFeatured = p.isFeatured
    form.seoTitle = p.seoTitle ?? ''
    form.seoDescription = p.seoDescription ?? ''
    form.sizeGuideId = p.sizeGuideId ?? ''
    form.categoryIds = [...p.categoryIds]
    form.layoutStyle = p.layoutStyle ?? 'standard'
    form.landingBenefits = p.landingBenefits ? p.landingBenefits.map(b => ({ ...b })) : []
    form.landingBlocks = p.landingBlocks ? p.landingBlocks.map(b => ({ ...b })) : []

    applyTranslationToForm('en', p.translations?.en)
    applyTranslationToForm('ar', p.translations?.ar)
  }
  catch (e) {
    toast.add({ title: 'Failed to load product', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await apiFetch(`/api/admin/products/${productId}`, {
      method: 'PUT',
      body: {
        name: form.name,
        description: form.description || null,
        shortDescription: form.shortDescription || null,
        sku: form.sku,
        basePrice: Math.round(form.basePrice * 100),
        compareAtPrice: form.compareAtPrice ? Math.round(form.compareAtPrice * 100) : null,
        status: form.status,
        isFeatured: form.isFeatured,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        sizeGuideId: form.sizeGuideId || null,
        categoryIds: form.categoryIds,
        layoutStyle: form.layoutStyle,
        landingBenefits: form.layoutStyle === 'landing'
          ? form.landingBenefits.filter(b => b.text.trim()).map(b => ({ icon: b.icon || undefined, text: b.text }))
          : null,
        landingBlocks: form.layoutStyle === 'landing'
          ? form.landingBlocks.filter(b => b.imageUrl).map(b => ({ imageUrl: b.imageUrl, caption: b.caption || undefined }))
          : null,
      },
    })
    toast.add({ title: 'Product saved', color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to save product', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function duplicate() {
  const copy = await apiFetch<{ id: string }>(`/api/admin/products/${productId}/duplicate`, { method: 'POST' })
  await navigateTo(`/admin/products/${copy.id}`)
}

async function archive() {
  await apiFetch(`/api/admin/products/${productId}/archive`, { method: 'POST' })
  await load()
  toast.add({ title: 'Product archived', color: 'success' })
}

async function removeProduct() {
  if (!confirm('Permanently delete this product? This cannot be undone.')) return
  await apiFetch(`/api/admin/products/${productId}`, { method: 'DELETE' })
  await navigateTo('/admin/products')
}

// --- Images ---
const uploading = ref(false)
async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    await $fetch(`/api/admin/products/${productId}/images`, { method: 'POST', body })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Upload failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeImage(imageId: string) {
  await apiFetch(`/api/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' })
  await load()
}

const settingPrimaryImageId = ref<string | null>(null)
async function setPrimaryImage(imageId: string) {
  settingPrimaryImageId.value = imageId
  try {
    await apiFetch(`/api/admin/products/${productId}/images/${imageId}/primary`, { method: 'PUT' })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to set primary image', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    settingPrimaryImageId.value = null
  }
}

// --- Landing page content (benefits + lifestyle blocks) ---
function addBenefit() {
  if (form.landingBenefits.length >= 6) return
  form.landingBenefits.push({ icon: '', text: '' })
}
function removeBenefit(index: number) {
  form.landingBenefits.splice(index, 1)
}

function addBlock() {
  if (form.landingBlocks.length >= 3) return
  form.landingBlocks.push({ imageUrl: '', caption: '' })
}
function removeBlock(index: number) {
  form.landingBlocks.splice(index, 1)
}

const uploadingBlockIndex = ref<number | null>(null)
async function onBlockImageSelected(e: Event, index: number) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingBlockIndex.value = index
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ data: { url: string } }>(`/api/admin/products/${productId}/landing-images`, { method: 'POST', body })
    form.landingBlocks[index].imageUrl = res.data.url
  }
  catch (e) {
    toast.add({ title: 'Image upload failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    uploadingBlockIndex.value = null
    input.value = ''
  }
}

// --- Generate benefits with AI (saves immediately, still editable/savable afterward) ---
const generatingBenefits = ref(false)
async function aiGenerateBenefits() {
  generatingBenefits.value = true
  try {
    const result = await apiFetch<{ benefits: LandingBenefit[], cost: number }>(
      `/api/admin/products/${productId}/ai-generate-landing-benefits`,
      { method: 'POST', body: {} },
    )
    form.landingBenefits = result.benefits.map(b => ({ ...b }))
    toast.add({ title: 'Benefits generated', description: `AI cost: $${result.cost.toFixed(4)} — review and save`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to generate benefits', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    generatingBenefits.value = false
  }
}

// --- Generate lifestyle photo blocks with AI (uses the first existing photo as reference) ---
interface ReviewLandingBlock { dataUrl: string, caption: string, sceneId: string, regenerating: boolean }
const landingBlocksModalOpen = ref(false)
const landingBlocksPhase = ref<'generating' | 'review'>('generating')
const landingBlocksGeneratingLabel = ref('')
const landingBlocksCost = ref(0)
const reviewLandingBlocks = ref<ReviewLandingBlock[]>([])
const savingLandingBlocks = ref(false)

async function openGenerateLandingBlocks() {
  if (!product.value?.images.length) {
    toast.add({ title: 'Upload at least one photo first', description: 'AI needs an existing product photo to generate lifestyle shots from.', color: 'warning' })
    return
  }
  const remaining = 3 - form.landingBlocks.length
  if (remaining <= 0) return

  landingBlocksModalOpen.value = true
  landingBlocksPhase.value = 'generating'
  landingBlocksCost.value = 0
  reviewLandingBlocks.value = []
  landingBlocksGeneratingLabel.value = 'Preparing reference photo…'
  try {
    const refBlob = await (await fetch(product.value.images[0].url)).blob()
    const dataUrl = await fileToDataUrl(refBlob)

    landingBlocksGeneratingLabel.value = 'Generating lifestyle photos — this can take up to a minute…'
    const defaultScenes = ['lifestyle-casablanca-street', 'lifestyle-casablanca-cafe'].slice(0, remaining)
    const result = await apiFetch<{ blocks: Array<{ dataUrl: string, caption: string, sceneId: string }>, cost: number }>(
      '/api/admin/ai/landing-blocks',
      { method: 'POST', body: { imageDataUrl: dataUrl, productName: form.name, sceneIds: defaultScenes } },
    )
    landingBlocksCost.value += result.cost
    reviewLandingBlocks.value = result.blocks.map(b => ({ dataUrl: b.dataUrl, caption: b.caption, sceneId: b.sceneId, regenerating: false }))
    landingBlocksPhase.value = 'review'
  }
  catch (e) {
    toast.add({ title: 'Generation failed', description: apiErrorMessage(e), color: 'error' })
    landingBlocksModalOpen.value = false
  }
}

async function regenerateLandingBlock(block: ReviewLandingBlock) {
  if (!product.value?.images.length) return
  block.regenerating = true
  try {
    const refBlob = await (await fetch(product.value.images[0].url)).blob()
    const dataUrl = await fileToDataUrl(refBlob)
    const result = await apiFetch<{ blocks: Array<{ dataUrl: string, caption: string, sceneId: string }>, cost: number }>(
      '/api/admin/ai/landing-blocks',
      { method: 'POST', body: { imageDataUrl: dataUrl, productName: form.name, sceneIds: [block.sceneId] } },
    )
    landingBlocksCost.value += result.cost
    if (result.blocks[0]) {
      block.dataUrl = result.blocks[0].dataUrl
      block.caption = result.blocks[0].caption
    }
  }
  catch (e) {
    toast.add({ title: 'Regeneration failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    block.regenerating = false
  }
}

function removeReviewLandingBlock(block: ReviewLandingBlock) {
  reviewLandingBlocks.value = reviewLandingBlocks.value.filter(b => b !== block)
}

async function saveLandingBlocks() {
  if (!reviewLandingBlocks.value.length) {
    landingBlocksModalOpen.value = false
    return
  }
  savingLandingBlocks.value = true
  try {
    await apiFetch(`/api/admin/products/${productId}/ai-landing-blocks`, {
      method: 'POST',
      body: { blocks: reviewLandingBlocks.value.map(b => ({ imageDataUrl: b.dataUrl, caption: b.caption })) },
    })
    landingBlocksModalOpen.value = false
    await load()
    toast.add({ title: 'Lifestyle blocks added', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save blocks', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingLandingBlocks.value = false
  }
}

async function aiTranslateLocale(locale: TranslatableLocale) {
  translating.value = locale
  try {
    const result = await apiFetch<{ translations: Record<string, TranslationFields>, cost: number }>(
      `/api/admin/products/${productId}/ai-translate`,
      { method: 'POST', body: { locales: [locale] } },
    )
    applyTranslationToForm(locale, result.translations[locale])
    toast.add({ title: `Translated into ${LOCALE_LABELS[locale]}`, description: `AI cost: $${result.cost.toFixed(4)} — review before saving`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Translation failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    translating.value = null
  }
}

async function saveTranslation(locale: TranslatableLocale) {
  savingTranslation.value = locale
  try {
    const f = translationForms[locale]
    await apiFetch(`/api/admin/products/${productId}/translations/${locale}`, {
      method: 'PUT',
      body: {
        name: f.name || null,
        shortDescription: f.shortDescription || null,
        description: f.description || null,
        seoTitle: f.seoTitle || null,
        seoDescription: f.seoDescription || null,
        landingBenefits: form.layoutStyle === 'landing' ? f.landingBenefits.filter(b => b.text.trim()) : null,
        landingBlockCaptions: form.layoutStyle === 'landing' ? f.landingBlockCaptions : null,
      },
    })
    toast.add({ title: `${LOCALE_LABELS[locale]} translation saved`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save translation', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingTranslation.value = null
  }
}

// --- SEO generation ---
const generatingSeo = ref(false)
async function aiGenerateSeo() {
  generatingSeo.value = true
  try {
    const result = await apiFetch<{ seoTitle: string, seoDescription: string, cost: number }>(
      `/api/admin/products/${productId}/ai-generate-seo`,
      { method: 'POST', body: {} },
    )
    form.seoTitle = result.seoTitle
    form.seoDescription = result.seoDescription
    toast.add({ title: 'SEO generated', description: `AI cost: $${result.cost.toFixed(4)} — review and save`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to generate SEO', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    generatingSeo.value = false
  }
}

// --- Generate more photos with AI (uses the first existing photo as reference) ---
interface AiReviewImage { dataUrl: string, kept: boolean, regenerating: boolean, sceneId: string }
interface AiImageScene { id: string, label: string, hasModel: boolean }
const aiImagesModalOpen = ref(false)
const aiImagesPhase = ref<'pick' | 'generating' | 'review'>('pick')
const aiGeneratingLabel = ref('')
const aiReviewImages = ref<AiReviewImage[]>([])
const aiReferenceDataUrl = ref<string | null>(null)
const aiImagesCost = ref(0)
const aiSavingImages = ref(false)
const aiImageScenes = ref<AiImageScene[]>([])
const aiSelectedSceneIds = ref<string[]>([])
const aiTargetColor = ref('')
const aiStylingNotes = ref('')

function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function addAiStylingPreset(text: string) {
  aiStylingNotes.value = aiStylingNotes.value.trim() ? `${aiStylingNotes.value.trim()}, ${text}` : text
}

async function openAiImagesModal() {
  if (!product.value?.images.length) {
    toast.add({ title: 'Upload at least one photo first', description: 'AI needs an existing photo to generate consistent new ones from.', color: 'warning' })
    return
  }
  aiImagesModalOpen.value = true
  aiImagesPhase.value = 'pick'
  aiReviewImages.value = []
  aiImagesCost.value = 0
  aiTargetColor.value = ''
  aiStylingNotes.value = ''
  try {
    if (!aiImageScenes.value.length) {
      aiImageScenes.value = await apiFetch<AiImageScene[]>('/api/admin/ai/image-scenes')
    }
    // Default selection: everything except the café scene.
    aiSelectedSceneIds.value = aiImageScenes.value.filter(s => s.id !== 'lifestyle-casablanca-cafe').map(s => s.id)

    const refBlob = await (await fetch(product.value.images[0].url)).blob()
    aiReferenceDataUrl.value = await fileToDataUrl(refBlob)
  }
  catch (e) {
    toast.add({ title: 'Failed to prepare reference photo', description: apiErrorMessage(e), color: 'error' })
    aiImagesModalOpen.value = false
  }
}

async function startAiImageGeneration() {
  if (!aiReferenceDataUrl.value || !aiSelectedSceneIds.value.length) return
  aiImagesPhase.value = 'generating'
  aiGeneratingLabel.value = `Generating ${aiSelectedSceneIds.value.length} photo${aiSelectedSceneIds.value.length > 1 ? 's' : ''} — this can take up to a minute…`
  try {
    const result = await apiFetch<{ images: Array<{ dataUrl: string, sceneId: string }>, cost: number }>('/api/admin/ai/product-images', {
      method: 'POST',
      body: {
        imageDataUrl: aiReferenceDataUrl.value,
        sceneIds: aiSelectedSceneIds.value,
        color: aiTargetColor.value.trim() || undefined,
        stylingNotes: aiStylingNotes.value.trim() || undefined,
      },
    })
    aiImagesCost.value += result.cost
    aiReviewImages.value = result.images.map(img => ({ dataUrl: img.dataUrl, kept: true, regenerating: false, sceneId: img.sceneId }))
    aiImagesPhase.value = 'review'
  }
  catch (e) {
    toast.add({ title: 'Generation failed', description: apiErrorMessage(e), color: 'error' })
    aiImagesPhase.value = 'pick'
  }
}

async function regenerateAiImage(image: AiReviewImage) {
  if (!aiReferenceDataUrl.value) return
  image.regenerating = true
  try {
    const result = await apiFetch<{ images: Array<{ dataUrl: string, sceneId: string }>, cost: number }>('/api/admin/ai/product-images', {
      method: 'POST',
      body: {
        imageDataUrl: aiReferenceDataUrl.value,
        sceneIds: [image.sceneId],
        color: aiTargetColor.value.trim() || undefined,
        stylingNotes: aiStylingNotes.value.trim() || undefined,
      },
    })
    aiImagesCost.value += result.cost
    if (result.images[0]) image.dataUrl = result.images[0].dataUrl
  }
  catch (e) {
    toast.add({ title: 'Regeneration failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    image.regenerating = false
  }
}

function removeAiImage(image: AiReviewImage) {
  aiReviewImages.value = aiReviewImages.value.filter(i => i !== image)
}

async function saveAiImages() {
  const kept = aiReviewImages.value.filter(i => i.kept).map(i => i.dataUrl)
  if (!kept.length) {
    aiImagesModalOpen.value = false
    return
  }
  aiSavingImages.value = true
  try {
    await apiFetch(`/api/admin/products/${productId}/ai-images`, { method: 'POST', body: { imageDataUrls: kept } })
    aiImagesModalOpen.value = false
    await load()
    toast.add({ title: 'Photos added', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save photos', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    aiSavingImages.value = false
  }
}

// --- Variants ---
const variantModalOpen = ref(false)
const variantForm = reactive({ sku: '', price: null as number | null, stock: 0, isActive: true, selectedValues: {} as Record<string, string> })
const savingVariant = ref(false)

function openVariantModal() {
  variantForm.sku = ''
  variantForm.price = null
  variantForm.stock = 0
  variantForm.isActive = true
  variantForm.selectedValues = {}
  variantModalOpen.value = true
}

async function createVariant() {
  savingVariant.value = true
  try {
    const attributeValueIds = Object.values(variantForm.selectedValues).filter(Boolean)
    await apiFetch(`/api/admin/products/${productId}/variants`, {
      method: 'POST',
      body: {
        sku: variantForm.sku,
        price: variantForm.price ? Math.round(variantForm.price * 100) : null,
        stock: variantForm.stock,
        isActive: variantForm.isActive,
        attributeValueIds,
      },
    })
    variantModalOpen.value = false
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to create variant', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingVariant.value = false
  }
}

async function toggleVariantActive(variant: Variant) {
  await apiFetch(`/api/admin/products/${productId}/variants/${variant.id}`, {
    method: 'PUT',
    body: { isActive: !variant.isActive },
  })
  await load()
}

async function removeVariant(variant: Variant) {
  if (!confirm(`Delete variant ${variant.sku}?`)) return
  await apiFetch(`/api/admin/products/${productId}/variants/${variant.id}`, { method: 'DELETE' })
  await load()
}

// --- Stock adjustment ---
const adjustModalOpen = ref(false)
const adjustingVariant = ref<Variant | null>(null)
const adjustForm = reactive({ delta: 0, reason: 'restock' as 'restock' | 'manual_adjustment', note: '' })
const adjusting = ref(false)

function openAdjust(variant: Variant) {
  adjustingVariant.value = variant
  adjustForm.delta = 0
  adjustForm.reason = 'restock'
  adjustForm.note = ''
  adjustModalOpen.value = true
}

async function submitAdjust() {
  if (!adjustingVariant.value || !adjustForm.delta) return
  adjusting.value = true
  try {
    await apiFetch('/api/admin/inventory/adjustments', {
      method: 'POST',
      body: { variantId: adjustingVariant.value.id, delta: adjustForm.delta, reason: adjustForm.reason, note: adjustForm.note || undefined },
    })
    adjustModalOpen.value = false
    await load()
  }
  catch (e) {
    toast.add({ title: 'Adjustment failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    adjusting.value = false
  }
}

function variantLabel(variant: Variant) {
  return variant.attributes.map(a => `${a.attributeName}: ${a.value}`).join(' / ') || '—'
}

onMounted(load)
</script>

<template>
  <div v-if="!loading && product">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl">{{ product.name }}</h1>
        <p class="text-sm text-stone-500">/{{ product.slug }}</p>
      </div>
      <div class="flex gap-2">
        <UButton variant="soft" @click="duplicate">Duplicate</UButton>
        <UButton variant="soft" color="warning" @click="archive">Archive</UButton>
        <UButton variant="soft" color="error" @click="removeProduct">Delete</UButton>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <UCard class="lg:col-span-2">
        <template #header><p class="font-medium">Details</p></template>
        <form class="space-y-4" @submit.prevent="save">
          <UFormField label="Name"><UInput v-model="form.name" required class="w-full" /></UFormField>
          <UFormField label="Short description"><UTextarea v-model="form.shortDescription" class="w-full" /></UFormField>
          <UFormField label="Description"><UTextarea v-model="form.description" :rows="5" class="w-full" /></UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="SKU"><UInput v-model="form.sku" required class="w-full" /></UFormField>
            <UFormField label="Status">
              <USelect
                v-model="form.status"
                :items="[{ label: 'Draft', value: 'draft' }, { label: 'Active', value: 'active' }, { label: 'Archived', value: 'archived' }]"
              />
            </UFormField>
            <UFormField label="Base price (DH)"><UInputNumber v-model="form.basePrice" :min="0" :step="1" :step-snapping="false" class="w-full" /></UFormField>
            <UFormField label="Compare-at price (DH)"><UInputNumber v-model="form.compareAtPrice" :min="0" :step="1" :step-snapping="false" class="w-full" /></UFormField>
          </div>

          <UFormField label="Size guide">
            <USelect
              v-model="sizeGuideSelectValue"
              :items="[{ label: 'None', value: 'none' }, ...sizeGuides.map(g => ({ label: g.title, value: g.id }))]"
            />
          </UFormField>

          <UFormField label="Categories">
            <div class="flex flex-wrap gap-3">
              <UCheckbox
                v-for="cat in categories"
                :key="cat.id"
                :model-value="form.categoryIds.includes(cat.id)"
                :label="cat.name"
                @update:model-value="(v) => form.categoryIds = v ? [...form.categoryIds, cat.id] : form.categoryIds.filter(id => id !== cat.id)"
              />
            </div>
          </UFormField>

          <UCheckbox v-model="form.isFeatured" label="Featured product" />

          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">SEO</p>
            <UButton size="xs" variant="soft" icon="i-lucide-sparkles" :loading="generatingSeo" @click="aiGenerateSeo">
              Generate with AI
            </UButton>
          </div>
          <UFormField label="SEO title"><UInput v-model="form.seoTitle" class="w-full" /></UFormField>
          <UFormField label="SEO description"><UTextarea v-model="form.seoDescription" class="w-full" /></UFormField>

          <UButton type="submit" :loading="saving">Save changes</UButton>
        </form>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <p class="font-medium">Images</p>
            <UButton size="xs" variant="soft" icon="i-lucide-sparkles" @click="openAiImagesModal">
              Generate more with AI
            </UButton>
          </div>
        </template>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="(image, i) in product.images" :key="image.id" class="product-media group relative rounded-md">
            <img :src="image.url" :alt="image.altText ?? ''" class="h-full w-full object-cover">
            <UBadge v-if="i === 0" size="xs" color="primary" variant="solid" class="absolute left-1 top-1">
              Primary
            </UBadge>
            <UButton
              v-else
              size="xs" variant="solid" color="neutral" icon="i-lucide-star"
              class="absolute left-1 top-1 opacity-0 group-hover:opacity-100"
              :loading="settingPrimaryImageId === image.id"
              @click="setPrimaryImage(image.id)"
            >
              Set as primary
            </UButton>
            <UButton
              size="xs" variant="solid" color="error" icon="i-lucide-trash-2"
              class="absolute right-1 top-1 opacity-0 group-hover:opacity-100"
              @click="removeImage(image.id)"
            />
          </div>
        </div>
        <label class="mt-3 block">
          <span class="sr-only">Upload image</span>
          <input type="file" accept="image/*" :disabled="uploading" class="text-sm" @change="onFileSelected">
        </label>
      </UCard>
    </div>

    <UCard class="mt-6">
      <template #header><p class="font-medium">Landing page</p></template>
      <p class="text-sm text-stone-500">
        Switch this product to a long-form, single-product page with an embedded order form that
        skips the cart entirely — modeled on single-product ad landing pages.
      </p>

      <UFormField label="Layout" class="mt-4 max-w-xs">
        <USelect
          v-model="form.layoutStyle"
          :items="[{ label: 'Standard (cart & checkout)', value: 'standard' }, { label: 'Landing (direct order form)', value: 'landing' }]"
        />
      </UFormField>

      <div v-if="form.layoutStyle === 'landing'" class="mt-6 space-y-8">
        <div>
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">
              Benefits ("why you'll love it")
            </p>
            <div class="flex gap-2">
              <UButton size="xs" variant="soft" icon="i-lucide-sparkles" :loading="generatingBenefits" @click="aiGenerateBenefits">
                Generate with AI
              </UButton>
              <UButton size="xs" variant="soft" icon="i-lucide-plus" :disabled="form.landingBenefits.length >= 6" @click="addBenefit">
                Add benefit
              </UButton>
            </div>
          </div>
          <p v-if="!form.landingBenefits.length" class="mt-2 text-sm text-stone-400">
            No benefits yet.
          </p>
          <div v-for="(benefit, i) in form.landingBenefits" :key="i" class="mt-3 flex items-start gap-2">
            <UInput v-model="benefit.icon" placeholder="✨" class="w-16" />
            <UInput v-model="benefit.text" placeholder="A short selling point…" class="w-full" />
            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeBenefit(i)" />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">
              Lifestyle photo blocks
            </p>
            <div class="flex gap-2">
              <UButton
                size="xs" variant="soft" icon="i-lucide-sparkles"
                :disabled="form.landingBlocks.length >= 3"
                @click="openGenerateLandingBlocks"
              >
                Generate with AI
              </UButton>
              <UButton size="xs" variant="soft" icon="i-lucide-plus" :disabled="form.landingBlocks.length >= 3" @click="addBlock">
                Add block
              </UButton>
            </div>
          </div>
          <p v-if="!form.landingBlocks.length" class="mt-2 text-sm text-stone-400">
            No lifestyle blocks yet.
          </p>
          <div v-for="(block, i) in form.landingBlocks" :key="i" class="mt-3 flex gap-3 rounded-md border border-stone-200 p-3">
            <div class="product-media size-24 shrink-0 rounded-md">
              <img v-if="block.imageUrl" :src="block.imageUrl" alt="" class="h-full w-full object-cover">
              <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
                <UIcon name="i-lucide-image" class="size-6" />
              </div>
            </div>
            <div class="flex-1 space-y-2">
              <label class="block">
                <span class="sr-only">Upload image</span>
                <input type="file" accept="image/*" :disabled="uploadingBlockIndex === i" class="text-sm" @change="(e) => onBlockImageSelected(e, i)">
              </label>
              <UInput v-model="block.caption" placeholder="Short caption…" class="w-full" />
            </div>
            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeBlock(i)" />
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <UButton :loading="saving" @click="save">
          Save changes
        </UButton>
      </div>
    </UCard>

    <UCard class="mt-6">
      <template #header><p class="font-medium">Translations</p></template>
      <p class="text-sm text-stone-500">
        French uses the fields in "Details" above. Generate English/Arabic copy with AI, review it,
        then save — customers browsing in that language see this instead of the French version
        (falling back to French for anything left blank).
      </p>

      <div class="mt-4 flex gap-2">
        <UButton
          v-for="locale in (['en', 'ar'] as const)" :key="locale"
          size="xs" :variant="activeLocale === locale ? 'solid' : 'soft'"
          @click="activeLocale = locale"
        >
          {{ LOCALE_LABELS[locale] }}
        </UButton>
      </div>

      <div class="mt-4 space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium">{{ LOCALE_LABELS[activeLocale] }} content</p>
          <UButton
            size="xs" variant="soft" icon="i-lucide-sparkles"
            :loading="translating === activeLocale"
            @click="aiTranslateLocale(activeLocale)"
          >
            Translate from French
          </UButton>
        </div>

        <UFormField label="Name"><UInput v-model="translationForms[activeLocale].name" class="w-full" /></UFormField>
        <UFormField label="Short description"><UTextarea v-model="translationForms[activeLocale].shortDescription" class="w-full" /></UFormField>
        <UFormField label="Description"><UTextarea v-model="translationForms[activeLocale].description" :rows="5" class="w-full" /></UFormField>
        <UFormField label="SEO title"><UInput v-model="translationForms[activeLocale].seoTitle" class="w-full" /></UFormField>
        <UFormField label="SEO description"><UTextarea v-model="translationForms[activeLocale].seoDescription" class="w-full" /></UFormField>

        <div v-if="form.layoutStyle === 'landing'">
          <p class="text-sm font-medium">Benefits</p>
          <p v-if="!translationForms[activeLocale].landingBenefits.length" class="mt-1 text-sm text-stone-400">
            Translate to populate, or they'll fall back to the French benefits.
          </p>
          <div v-for="(benefit, i) in translationForms[activeLocale].landingBenefits" :key="i" class="mt-2 flex items-center gap-2">
            <span class="w-8 shrink-0 text-center">{{ benefit.icon }}</span>
            <UInput v-model="benefit.text" class="w-full" />
          </div>

          <p class="mt-4 text-sm font-medium">Lifestyle block captions</p>
          <p v-if="!form.landingBlocks.length" class="mt-1 text-sm text-stone-400">
            No lifestyle blocks to caption.
          </p>
          <div v-for="(block, i) in form.landingBlocks" :key="i" class="mt-2 flex items-center gap-2">
            <div class="product-media size-10 shrink-0 rounded">
              <img v-if="block.imageUrl" :src="block.imageUrl" alt="" class="h-full w-full object-cover">
            </div>
            <UInput
              v-model="translationForms[activeLocale].landingBlockCaptions[i]"
              :placeholder="block.caption || 'Caption…'" class="w-full"
            />
          </div>
        </div>

        <div class="flex justify-end">
          <UButton :loading="savingTranslation === activeLocale" @click="saveTranslation(activeLocale)">
            Save {{ LOCALE_LABELS[activeLocale] }}
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center justify-between">
          <p class="font-medium">Variants</p>
          <UButton size="sm" icon="i-lucide-plus" @click="openVariantModal">Add variant</UButton>
        </div>
      </template>


      <table class="w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th class="py-2">SKU</th>
            <th class="py-2">Attributes</th>
            <th class="py-2">Price override</th>
            <th class="py-2">Stock</th>
            <th class="py-2">Active</th>
            <th class="py-2" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="!product.variants.length">
            <td colspan="6" class="py-6 text-center text-stone-400">No variants yet — this product sells as a single SKU.</td>
          </tr>
          <tr v-for="variant in product.variants" :key="variant.id" class="border-t border-stone-100">
            <td class="py-2 font-medium">{{ variant.sku }}</td>
            <td class="py-2">{{ variantLabel(variant) }}</td>
            <td class="py-2">{{ variant.price ? (variant.price / 100).toFixed(2) : '—' }}</td>
            <td class="py-2">
              {{ variant.stock }}
              <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openAdjust(variant)" />
            </td>
            <td class="py-2">
              <USwitch :model-value="variant.isActive" @update:model-value="toggleVariantActive(variant)" />
            </td>
            <td class="py-2 text-right">
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeVariant(variant)" />
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UModal v-model:open="aiImagesModalOpen" title="Generate more photos with AI" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div v-if="aiImagesPhase === 'pick'">
          <p class="text-sm text-stone-500">
            Choose which shots to generate from this product's first photo. Optionally recolor the
            garment or add model styling notes (e.g. a hijab) — these apply to every shot below.
          </p>

          <UFormField label="Photos to generate" class="mt-4">
            <div class="flex flex-wrap gap-3">
              <UCheckbox
                v-for="scene in aiImageScenes" :key="scene.id"
                :model-value="aiSelectedSceneIds.includes(scene.id)" :label="scene.label"
                @update:model-value="(v) => aiSelectedSceneIds = v ? [...aiSelectedSceneIds, scene.id] : aiSelectedSceneIds.filter(id => id !== scene.id)"
              />
            </div>
          </UFormField>

          <div class="mt-4 grid grid-cols-2 gap-4">
            <UFormField label="Target color (optional)" description="e.g. &quot;emerald green&quot; — recolors the garment. Leave empty to keep its original color.">
              <UInput v-model="aiTargetColor" placeholder="e.g. emerald green" class="w-full" />
            </UFormField>
            <UFormField label="Model styling notes (optional)">
              <UInput v-model="aiStylingNotes" placeholder="e.g. wearing a hijab" class="w-full" />
              <UButton size="xs" variant="soft" class="mt-2" @click="addAiStylingPreset('wearing a neatly styled hijab that complements the outfit')">
                + Hijab
              </UButton>
            </UFormField>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="aiImagesModalOpen = false">Cancel</UButton>
            <UButton :disabled="!aiSelectedSceneIds.length" @click="startAiImageGeneration">
              Generate {{ aiSelectedSceneIds.length }} photo{{ aiSelectedSceneIds.length === 1 ? '' : 's' }}
            </UButton>
          </div>
        </div>

        <div v-else-if="aiImagesPhase === 'generating'" class="flex items-center gap-3 py-10">
          <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
          <p class="text-sm text-stone-600">{{ aiGeneratingLabel }}</p>
        </div>

        <div v-else>
          <p class="text-sm text-stone-500">
            Review, regenerate, or remove any shot before saving. AI cost so far: ${{ aiImagesCost.toFixed(4) }}
          </p>
          <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div v-for="image in aiReviewImages" :key="image.sceneId">
              <div class="product-media relative aspect-[3/4] rounded-md">
                <img :src="image.dataUrl" alt="" class="h-full w-full object-cover">
                <div v-if="image.regenerating" class="absolute inset-0 flex items-center justify-center bg-white/70">
                  <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
                </div>
              </div>
              <p class="mt-1 text-center text-xs text-stone-400">{{ aiImageScenes.find(s => s.id === image.sceneId)?.label }}</p>
              <div class="mt-2 flex justify-center gap-1">
                <UButton size="xs" variant="soft" icon="i-lucide-refresh-cw" :disabled="image.regenerating" @click="regenerateAiImage(image)" />
                <UButton size="xs" variant="soft" color="error" icon="i-lucide-trash-2" @click="removeAiImage(image)" />
              </div>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="aiImagesPhase = 'pick'">Back</UButton>
            <UButton :loading="aiSavingImages" :disabled="!aiReviewImages.length" @click="saveAiImages">
              Add {{ aiReviewImages.length }} photo{{ aiReviewImages.length === 1 ? '' : 's' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="landingBlocksModalOpen" title="Generate lifestyle photo blocks with AI" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div v-if="landingBlocksPhase === 'generating'" class="flex items-center gap-3 py-10">
          <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
          <p class="text-sm text-stone-600">{{ landingBlocksGeneratingLabel }}</p>
        </div>
        <div v-else>
          <p class="text-sm text-stone-500">
            Generated from this product's first photo. Review, regenerate, or remove before saving.
            AI cost so far: ${{ landingBlocksCost.toFixed(4) }}
          </p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div v-for="block in reviewLandingBlocks" :key="block.sceneId" class="rounded-md border border-stone-200 p-3">
              <div class="product-media relative aspect-[3/4] rounded-md">
                <img :src="block.dataUrl" alt="" class="h-full w-full object-cover">
                <div v-if="block.regenerating" class="absolute inset-0 flex items-center justify-center bg-white/70">
                  <UIcon name="i-lucide-loader-2" class="size-5 animate-spin" />
                </div>
              </div>
              <UInput v-model="block.caption" class="mt-2 w-full" placeholder="Caption…" />
              <div class="mt-2 flex justify-center gap-1">
                <UButton size="xs" variant="soft" icon="i-lucide-refresh-cw" :disabled="block.regenerating" @click="regenerateLandingBlock(block)" />
                <UButton size="xs" variant="soft" color="error" icon="i-lucide-trash-2" @click="removeReviewLandingBlock(block)" />
              </div>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="landingBlocksModalOpen = false">Cancel</UButton>
            <UButton :loading="savingLandingBlocks" :disabled="!reviewLandingBlocks.length" @click="saveLandingBlocks">
              Add {{ reviewLandingBlocks.length }} block{{ reviewLandingBlocks.length === 1 ? '' : 's' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="variantModalOpen" title="New variant">
      <template #body>
        <form class="space-y-4" @submit.prevent="createVariant">
          <UFormField label="SKU"><UInput v-model="variantForm.sku" required class="w-full" /></UFormField>
          <UFormField label="Price override (DH, optional)"><UInputNumber v-model="variantForm.price" :min="0" :step="1" :step-snapping="false" class="w-full" /></UFormField>
          <UFormField label="Initial stock"><UInputNumber v-model="variantForm.stock" :min="0" class="w-full" /></UFormField>
          <UFormField v-for="attr in attributes" :key="attr.id" :label="attr.name">
            <USelect
              :model-value="variantForm.selectedValues[attr.id] || 'none'"
              :items="[{ label: 'None', value: 'none' }, ...attr.values.map(v => ({ label: v.value, value: v.id }))]"
              @update:model-value="(v) => variantForm.selectedValues[attr.id] = v === 'none' ? '' : v"
            />
          </UFormField>
          <UCheckbox v-model="variantForm.isActive" label="Active" />
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="variantModalOpen = false">Cancel</UButton>
            <UButton type="submit" :loading="savingVariant">Create</UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="adjustModalOpen" title="Adjust stock">
      <template #body>
        <form class="space-y-4" @submit.prevent="submitAdjust">
          <p class="text-sm text-stone-500">{{ adjustingVariant?.sku }} — current stock: {{ adjustingVariant?.stock }}</p>
          <UFormField label="Change (use negative to remove stock)">
            <UInputNumber v-model="adjustForm.delta" class="w-full" />
          </UFormField>
          <UFormField label="Reason">
            <USelect
              v-model="adjustForm.reason"
              :items="[{ label: 'Restock', value: 'restock' }, { label: 'Manual adjustment', value: 'manual_adjustment' }]"
            />
          </UFormField>
          <UFormField label="Note (optional)"><UInput v-model="adjustForm.note" class="w-full" /></UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="adjustModalOpen = false">Cancel</UButton>
            <UButton type="submit" :loading="adjusting">Apply</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
  <p v-else class="text-stone-400">Loading…</p>
</template>
