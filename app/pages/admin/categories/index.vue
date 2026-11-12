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

const toast = useToast()
const categories = ref<Category[]>([])
const loading = ref(true)

const modalOpen = ref(false)
const editing = ref<Category | null>(null)
const form = reactive({ name: '', description: '', parentId: '', isActive: true })
const saving = ref(false)

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
  modalOpen.value = true
}

function openEdit(category: Category) {
  editing.value = category
  form.name = category.name
  form.description = category.description ?? ''
  form.parentId = category.parentId ?? ''
  form.isActive = category.isActive
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = {
      name: form.name,
      description: form.description || null,
      parentId: form.parentId || null,
      isActive: form.isActive,
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
      <UButton icon="i-lucide-plus" @click="openCreate">
        New category
      </UButton>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Slug</th>
            <th class="px-4 py-3">Parent</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-8 text-center text-stone-400">Loading…</td>
          </tr>
          <tr v-else-if="!categories.length">
            <td colspan="5" class="px-4 py-8 text-center text-stone-400">No categories yet.</td>
          </tr>
          <tr v-for="category in categories" :key="category.id" class="border-t border-stone-100">
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
      </template>
    </UModal>
  </div>
</template>
