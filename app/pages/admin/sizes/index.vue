<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface SizeGuide {
  id: string
  title: string
  categoryId: string | null
  content: { columns: string[], rows: Record<string, string>[] }
}
interface Category { id: string, name: string }

const toast = useToast()
const guides = ref<SizeGuide[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)

const modalOpen = ref(false)
const editing = ref<SizeGuide | null>(null)
const form = reactive({ title: '', categoryId: '', columnsCsv: 'Size,Chest,Waist', rowsText: 'S,34,28\nM,36,30\nL,38,32' })
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    [guides.value, categories.value] = await Promise.all([
      apiFetch<SizeGuide[]>('/api/admin/size-guides'),
      apiFetch<Category[]>('/api/admin/categories'),
    ])
  }
  catch (e) {
    toast.add({ title: 'Failed to load size guides', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.title = ''
  form.categoryId = ''
  form.columnsCsv = 'Size,Chest,Waist'
  form.rowsText = 'S,34,28\nM,36,30\nL,38,32'
  modalOpen.value = true
}

function openEdit(guide: SizeGuide) {
  editing.value = guide
  form.title = guide.title
  form.categoryId = guide.categoryId ?? ''
  form.columnsCsv = guide.content.columns.join(',')
  form.rowsText = guide.content.rows.map(row => guide.content.columns.map(c => row[c] ?? '').join(',')).join('\n')
  modalOpen.value = true
}

function parseContent() {
  const columns = form.columnsCsv.split(',').map(c => c.trim()).filter(Boolean)
  const rows = form.rowsText.split('\n').map(l => l.trim()).filter(Boolean).map((line) => {
    const cells = line.split(',').map(c => c.trim())
    return Object.fromEntries(columns.map((col, i) => [col, cells[i] ?? '']))
  })
  return { columns, rows }
}

async function save() {
  saving.value = true
  try {
    const payload = { title: form.title, categoryId: form.categoryId || null, content: parseContent() }
    if (editing.value) {
      await apiFetch(`/api/admin/size-guides/${editing.value.id}`, { method: 'PUT', body: payload })
    }
    else {
      await apiFetch('/api/admin/size-guides', { method: 'POST', body: payload })
    }
    modalOpen.value = false
    await load()
    toast.add({ title: 'Size guide saved', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save size guide', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function remove(id: string) {
  if (!confirm('Delete this size guide?')) return
  await apiFetch(`/api/admin/size-guides/${id}`, { method: 'DELETE' })
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-display text-2xl">Size guides</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">New size guide</UButton>
    </div>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="guide in guides" :key="guide.id">
        <template #header>
          <div class="flex items-center justify-between">
            <p class="font-medium">{{ guide.title }}</p>
            <div class="flex gap-1">
              <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEdit(guide)" />
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="remove(guide.id)" />
            </div>
          </div>
        </template>
        <p class="text-xs text-stone-500">
          {{ categories.find(c => c.id === guide.categoryId)?.name ?? 'No category assigned' }}
        </p>
        <table class="mt-2 w-full text-xs">
          <thead>
            <tr><th v-for="col in guide.content.columns" :key="col" class="pr-3 text-left text-stone-500">{{ col }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in guide.content.rows" :key="i">
              <td v-for="col in guide.content.columns" :key="col" class="pr-3">{{ row[col] }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>
      <p v-if="!loading && !guides.length" class="text-stone-400">No size guides yet.</p>
    </div>

    <UModal v-model:open="modalOpen" :title="editing ? 'Edit size guide' : 'New size guide'">
      <template #body>
        <form class="space-y-4" @submit.prevent="save">
          <UFormField label="Title"><UInput v-model="form.title" required class="w-full" /></UFormField>
          <UFormField label="Category">
            <USelect
              v-model="form.categoryId"
              :items="[{ label: 'None', value: '' }, ...categories.map(c => ({ label: c.name, value: c.id }))]"
            />
          </UFormField>
          <UFormField label="Columns (comma separated)">
            <UInput v-model="form.columnsCsv" class="w-full" />
          </UFormField>
          <UFormField label="Rows (one per line, comma separated values matching columns)">
            <UTextarea v-model="form.rowsText" :rows="4" class="w-full font-mono text-xs" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="modalOpen = false">Cancel</UButton>
            <UButton type="submit" :loading="saving">Save</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
