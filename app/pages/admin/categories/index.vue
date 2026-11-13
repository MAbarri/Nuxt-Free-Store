<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  parentId: string | null
  isActive: boolean
  sortOrder: number
}

type TranslatableLocale = 'en' | 'ar'
const LOCALE_LABELS: Record<TranslatableLocale, string> = { en: 'English', ar: 'Arabic' }

const toast = useToast()
const categories = ref<Category[]>([])
const loading = ref(true)

const modalOpen = ref(false)
const editing = ref<Category | null>(null)
const form = reactive({ name: '', description: '', parentId: '', isActive: true, imageUrl: null as string | null })
const saving = ref(false)
const uploadingImage = ref(false)

const activeLocale = ref<TranslatableLocale>('en')
const translating = ref<TranslatableLocale | null>(null)
const savingTranslation = ref<TranslatableLocale | null>(null)
const translationForms = reactive<Record<TranslatableLocale, { name: string, description: string }>>({
  en: { name: '', description: '' },
  ar: { name: '', description: '' },
})

const bulkTranslating = ref(false)
const bulkProgress = reactive({ done: 0, total: 0 })

async function load() {
  loading.value = true
  try {
    categories.value = await apiFetch<Category[]>('/api/admin/categories')
  }
  catch (e) {
    toast.add({ title: 'Failed to load categories', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.name = ''
  form.description = ''
  form.parentId = ''
  form.isActive = true
  form.imageUrl = null
  activeLocale.value = 'en'
  translationForms.en = { name: '', description: '' }
  translationForms.ar = { name: '', description: '' }
  modalOpen.value = true
}

async function openEdit(category: Category) {
  editing.value = category
  form.name = category.name
  form.description = category.description ?? ''
  form.parentId = category.parentId ?? ''
  form.isActive = category.isActive
  form.imageUrl = category.imageUrl
  activeLocale.value = 'en'
  translationForms.en = { name: '', description: '' }
  translationForms.ar = { name: '', description: '' }
  modalOpen.value = true

  try {
    const full = await apiFetch<Category & { translations: Partial<Record<TranslatableLocale, { name: string | null, description: string | null }>> }>(`/api/admin/categories/${category.id}`)
    for (const locale of ['en', 'ar'] as const) {
      const t = full.translations?.[locale]
      translationForms[locale] = { name: t?.name ?? '', description: t?.description ?? '' }
    }
  }
  catch {
    // Non-fatal — the modal still works for editing the French fields.
  }
}

async function aiTranslateLocale(locale: TranslatableLocale) {
  if (!editing.value) return
  translating.value = locale
  try {
    const result = await apiFetch<{ translations: Record<string, { name: string | null, description: string | null }>, cost: number }>(
      `/api/admin/categories/${editing.value.id}/ai-translate`,
      { method: 'POST', body: { locales: [locale] } },
    )
    const t = result.translations[locale]
    translationForms[locale] = { name: t?.name ?? '', description: t?.description ?? '' }
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
  if (!editing.value) return
  savingTranslation.value = locale
  try {
    const f = translationForms[locale]
    await apiFetch(`/api/admin/categories/${editing.value.id}/translations/${locale}`, {
      method: 'PUT',
      body: { name: f.name || null, description: f.description || null },
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

async function translateAllCategories() {
  if (!confirm('Translate every category into English and Arabic with AI? This overwrites any existing EN/AR translations.')) return
  bulkTranslating.value = true
  try {
    bulkProgress.done = 0
    bulkProgress.total = categories.value.length
    let totalCost = 0
    for (const category of categories.value) {
      try {
        const result = await apiFetch<{ cost: number }>(`/api/admin/categories/${category.id}/ai-translate`, { method: 'POST', body: {} })
        totalCost += result.cost
      }
      catch (e) {
        toast.add({ title: `Failed to translate "${category.name}"`, description: apiErrorMessage(e), color: 'error' })
      }
      bulkProgress.done++
    }
    toast.add({ title: 'Category translation complete', description: `${categories.value.length} categories — total AI cost: $${totalCost.toFixed(4)}`, color: 'success' })
  }
  finally {
    bulkTranslating.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload = {
      name: form.name,
      description: form.description || null,
      parentId: form.parentId || null,
      isActive: form.isActive,
      imageUrl: form.imageUrl,
    }
    if (editing.value) {
      await apiFetch(`/api/admin/categories/${editing.value.id}`, { method: 'PUT', body: payload })
    }
    else {
      await apiFetch('/api/admin/categories', { method: 'POST', body: payload })
    }
    modalOpen.value = false
    await load()
    toast.add({ title: 'Category saved', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save category', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function remove(category: Category) {
  if (!confirm(`Delete category "${category.name}"?`)) return
  try {
    await apiFetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' })
    await load()
    toast.add({ title: 'Category deleted', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to delete category', description: apiErrorMessage(e), color: 'error' })
  }
}

async function onImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingImage.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ data: { url: string } }>('/api/admin/categories/images', { method: 'POST', body })
    form.imageUrl = res.data.url
  }
  catch (e) {
    toast.add({ title: 'Image upload failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    uploadingImage.value = false
    input.value = ''
  }
}

function removeImage() {
  form.imageUrl = null
}

const parentOptions = computed(() => categories.value
  .filter(c => c.id !== editing.value?.id)
  .map(c => ({ label: c.name, value: c.id })))

onMounted(load)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-display text-2xl">
        Categories
      </h1>
      <div class="flex items-center gap-2">
        <span v-if="bulkTranslating" class="text-sm text-stone-500">{{ bulkProgress.done }}/{{ bulkProgress.total }}</span>
        <UButton variant="soft" icon="i-lucide-languages" :loading="bulkTranslating" @click="translateAllCategories">
          Translate all (AI)
        </UButton>
        <UButton icon="i-lucide-plus" @click="openCreate">
          New category
        </UButton>
      </div>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th class="px-4 py-3" />
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Slug</th>
            <th class="px-4 py-3">Parent</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-stone-400">Loading…</td>
          </tr>
          <tr v-else-if="!categories.length">
            <td colspan="6" class="px-4 py-8 text-center text-stone-400">No categories yet.</td>
          </tr>
          <tr v-for="category in categories" :key="category.id" class="border-t border-stone-100">
            <td class="px-4 py-3">
              <div class="size-10 overflow-hidden rounded bg-stone-100">
                <img v-if="category.imageUrl" :src="category.imageUrl" :alt="category.name" class="h-full w-full object-cover">
                <div v-else class="flex h-full w-full items-center justify-center text-stone-300">
                  <UIcon name="i-lucide-image" class="size-4" />
                </div>
              </div>
            </td>
            <td class="px-4 py-3 font-medium">{{ category.name }}</td>
            <td class="px-4 py-3 text-stone-500">{{ category.slug }}</td>
            <td class="px-4 py-3 text-stone-500">
              {{ categories.find(c => c.id === category.parentId)?.name ?? '—' }}
            </td>
            <td class="px-4 py-3">
              <UBadge :color="category.isActive ? 'success' : 'neutral'" variant="subtle">
                {{ category.isActive ? 'Active' : 'Inactive' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-right">
              <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEdit(category)" />
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="remove(category)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="modalOpen" :title="editing ? 'Edit category' : 'New category'">
      <template #body>
        <form class="space-y-4" @submit.prevent="save">
          <UFormField label="Name">
            <UInput v-model="form.name" required class="w-full" />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="form.description" class="w-full" />
          </UFormField>
          <UFormField label="Image">
            <div class="flex items-center gap-3">
              <div class="product-media size-20 overflow-hidden rounded-md">
                <img v-if="form.imageUrl" :src="form.imageUrl" alt="" class="h-full w-full object-cover">
                <div v-else class="flex h-full w-full items-center justify-center text-stone-300">
                  <UIcon name="i-lucide-image" class="size-6" />
                </div>
              </div>
              <div class="space-y-2">
                <input type="file" accept="image/*" :disabled="uploadingImage" class="text-sm" @change="onImageSelected">
                <p v-if="uploadingImage" class="text-xs text-stone-500">Uploading…</p>
                <UButton v-else-if="form.imageUrl" size="xs" variant="ghost" color="error" @click="removeImage">
                  Remove image
                </UButton>
              </div>
            </div>
          </UFormField>
          <UFormField label="Parent category">
            <USelect
              v-model="form.parentId"
              :items="[{ label: 'None', value: '' }, ...parentOptions]"
              class="w-full"
            />
          </UFormField>
          <UCheckbox v-model="form.isActive" label="Active" />
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="modalOpen = false">Cancel</UButton>
            <UButton type="submit" :loading="saving">Save</UButton>
          </div>
        </form>

        <div v-if="editing" class="mt-6 border-t border-stone-200 pt-4">
          <p class="text-sm font-medium">Translations</p>
          <p class="mt-1 text-sm text-stone-500">
            French uses the fields above. Generate English/Arabic with AI, review it, then save.
          </p>

          <div class="mt-3 flex gap-2">
            <UButton
              v-for="locale in (['en', 'ar'] as const)" :key="locale"
              size="xs" :variant="activeLocale === locale ? 'solid' : 'soft'"
              @click="activeLocale = locale"
            >
              {{ LOCALE_LABELS[locale] }}
            </UButton>
          </div>

          <div class="mt-3 space-y-3">
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
            <UFormField label="Description"><UTextarea v-model="translationForms[activeLocale].description" class="w-full" /></UFormField>
            <div class="flex justify-end">
              <UButton size="sm" :loading="savingTranslation === activeLocale" @click="saveTranslation(activeLocale)">
                Save {{ LOCALE_LABELS[activeLocale] }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
