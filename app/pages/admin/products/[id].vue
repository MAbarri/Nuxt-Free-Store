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
})

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
            <UFormField label="Base price (USD)"><UInputNumber v-model="form.basePrice" :min="0" :step="0.5" class="w-full" /></UFormField>
            <UFormField label="Compare-at price (USD)"><UInputNumber v-model="form.compareAtPrice" :min="0" :step="0.5" class="w-full" /></UFormField>
          </div>

          <UFormField label="Size guide">
            <USelect
              v-model="form.sizeGuideId"
              :items="[{ label: 'None', value: '' }, ...sizeGuides.map(g => ({ label: g.title, value: g.id }))]"
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

          <UFormField label="SEO title"><UInput v-model="form.seoTitle" class="w-full" /></UFormField>
          <UFormField label="SEO description"><UTextarea v-model="form.seoDescription" class="w-full" /></UFormField>

          <UButton type="submit" :loading="saving">Save changes</UButton>
        </form>
      </UCard>

      <UCard>
        <template #header><p class="font-medium">Images</p></template>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="image in product.images" :key="image.id" class="product-media group rounded-md">
            <img :src="image.url" :alt="image.altText ?? ''" class="h-full w-full object-cover">
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

    <UModal v-model:open="variantModalOpen" title="New variant">
      <template #body>
        <form class="space-y-4" @submit.prevent="createVariant">
          <UFormField label="SKU"><UInput v-model="variantForm.sku" required class="w-full" /></UFormField>
          <UFormField label="Price override (USD, optional)"><UInputNumber v-model="variantForm.price" :min="0" :step="0.5" class="w-full" /></UFormField>
          <UFormField label="Initial stock"><UInputNumber v-model="variantForm.stock" :min="0" class="w-full" /></UFormField>
          <UFormField v-for="attr in attributes" :key="attr.id" :label="attr.name">
            <USelect
              v-model="variantForm.selectedValues[attr.id]"
              :items="[{ label: 'None', value: '' }, ...attr.values.map(v => ({ label: v.value, value: v.id }))]"
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
