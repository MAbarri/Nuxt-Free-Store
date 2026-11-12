<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface AttributeValue {
  id: string
  value: string
  swatchHex: string | null
  swatchImageUrl: string | null
  sortOrder: number
}
interface Attribute {
  id: string
  name: string
  slug: string
  displayType: 'text' | 'select' | 'swatch'
  values: AttributeValue[]
}

const toast = useToast()
const attributes = ref<Attribute[]>([])
const loading = ref(true)

const newAttr = reactive({ name: '', displayType: 'select' as Attribute['displayType'] })
const creating = ref(false)

const valueDrafts = reactive<Record<string, { value: string, swatchHex: string }>>({})

async function load() {
  loading.value = true
  try {
    attributes.value = await apiFetch<Attribute[]>('/api/admin/attributes')
    for (const attr of attributes.value) {
      if (!valueDrafts[attr.id]) valueDrafts[attr.id] = { value: '', swatchHex: '#000000' }
    }
  }
  catch (e) {
    toast.add({ title: 'Failed to load attributes', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function createAttribute() {
  creating.value = true
  try {
    await apiFetch('/api/admin/attributes', { method: 'POST', body: newAttr })
    newAttr.name = ''
    newAttr.displayType = 'select'
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to create attribute', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    creating.value = false
  }
}

async function removeAttribute(id: string) {
  if (!confirm('Delete this attribute and all its values?')) return
  await apiFetch(`/api/admin/attributes/${id}`, { method: 'DELETE' })
  await load()
}

async function addValue(attr: Attribute) {
  const draft = valueDrafts[attr.id]
  if (!draft.value.trim()) return
  try {
    await apiFetch(`/api/admin/attributes/${attr.id}/values`, {
      method: 'POST',
      body: {
        value: draft.value,
        swatchHex: attr.displayType === 'swatch' ? draft.swatchHex : undefined,
      },
    })
    draft.value = ''
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to add value', description: apiErrorMessage(e), color: 'error' })
  }
}

async function removeValue(valueId: string) {
  await apiFetch(`/api/admin/attributes/values/${valueId}`, { method: 'DELETE' })
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Attributes
    </h1>
    <p class="mt-1 text-sm text-stone-500">
      Define product attributes like Size, Color or Material. Mark Color-like attributes as
      "swatch" to show them as color chips instead of a dropdown.
    </p>

    <UCard class="mt-6">
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="createAttribute">
        <UFormField label="New attribute name" class="grow">
          <UInput v-model="newAttr.name" required class="w-full" placeholder="e.g. Color" />
        </UFormField>
        <UFormField label="Display type">
          <USelect
            v-model="newAttr.displayType"
            :items="[{ label: 'Select (dropdown)', value: 'select' }, { label: 'Swatch', value: 'swatch' }, { label: 'Text', value: 'text' }]"
          />
        </UFormField>
        <UButton type="submit" :loading="creating">Add attribute</UButton>
      </form>
    </UCard>

    <p v-if="loading" class="mt-6 text-stone-400">Loading…</p>

    <div v-else class="mt-6 space-y-4">
      <UCard v-for="attr in attributes" :key="attr.id">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{{ attr.name }}</p>
              <UBadge color="neutral" variant="subtle">{{ attr.displayType }}</UBadge>
            </div>
            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeAttribute(attr.id)" />
          </div>
        </template>

        <div class="flex flex-wrap gap-2">
          <div
            v-for="value in attr.values"
            :key="value.id"
            class="flex items-center gap-2 rounded-full border border-stone-200 py-1 pl-3 pr-1 text-sm"
          >
            <span
              v-if="attr.displayType === 'swatch'"
              class="size-4 rounded-full border border-stone-300"
              :style="{ backgroundColor: value.swatchHex ?? undefined }"
            />
            {{ value.value }}
            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-x" @click="removeValue(value.id)" />
          </div>
        </div>

        <div class="mt-3 flex items-end gap-2">
          <UInput v-model="valueDrafts[attr.id].value" placeholder="New value" size="sm" />
          <input
            v-if="attr.displayType === 'swatch'"
            v-model="valueDrafts[attr.id].swatchHex"
            type="color"
            class="h-8 w-10 rounded border border-stone-200"
          >
          <UButton size="sm" variant="soft" @click="addValue(attr)">Add value</UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
