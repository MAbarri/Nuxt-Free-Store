<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ProductRow {
  id: string
  name: string
  sku: string
  basePrice: number
  status: 'draft' | 'active' | 'archived'
  isFeatured: boolean
  layoutStyle: 'standard' | 'landing'
}

const toast = useToast()
const rows = ref<ProductRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const search = ref('')
const status = ref<string>('')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const result = await apiFetch<{ rows: ProductRow[], total: number }>('/api/admin/products', {
      query: {
        page: page.value,
        pageSize,
        search: search.value || undefined,
        status: status.value || undefined,
      },
    })
    rows.value = result.rows
    total.value = result.total
  }
  catch (e) {
    toast.add({ title: 'Failed to load products', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

const statusColor: Record<ProductRow['status'], string> = {
  draft: 'neutral',
  active: 'success',
  archived: 'warning',
}

const createModalOpen = ref(false)
const createForm = reactive({ name: '', sku: '', basePrice: 0 })
const creating = ref(false)

const bulkTranslating = ref(false)
const bulkProgress = reactive({ done: 0, total: 0 })

async function translateAllProducts() {
  if (!confirm('Translate every product into English and Arabic with AI? This calls AI once per product and overwrites any existing EN/AR translations. It uses OpenRouter credits and may take a while.')) return
  bulkTranslating.value = true
  try {
    const all: ProductRow[] = []
    let page_ = 1
    for (;;) {
      const result = await apiFetch<{ rows: ProductRow[], total: number }>('/api/admin/products', { query: { page: page_, pageSize: 100 } })
      all.push(...result.rows)
      if (!result.rows.length || all.length >= result.total) break
      page_++
    }

    bulkProgress.done = 0
    bulkProgress.total = all.length
    let totalCost = 0
    for (const product of all) {
      try {
        const result = await apiFetch<{ cost: number }>(`/api/admin/products/${product.id}/ai-translate`, { method: 'POST', body: {} })
        totalCost += result.cost
      }
      catch (e) {
        toast.add({ title: `Failed to translate "${product.name}"`, description: apiErrorMessage(e), color: 'error' })
      }
      bulkProgress.done++
    }
    toast.add({ title: 'Catalog translation complete', description: `${all.length} products — total AI cost: $${totalCost.toFixed(4)}`, color: 'success' })
  }
  finally {
    bulkTranslating.value = false
  }
}

async function createProduct() {
  creating.value = true
  try {
    const product = await apiFetch<{ id: string }>('/api/admin/products', {
      method: 'POST',
      body: { name: createForm.name, sku: createForm.sku, basePrice: Math.round(createForm.basePrice * 100) },
    })
    createModalOpen.value = false
    await navigateTo(`/admin/products/${product.id}`)
  }
  catch (e) {
    toast.add({ title: 'Failed to create product', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    creating.value = false
  }
}

watch([page, status], load)
onMounted(load)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-display text-2xl">
        Products
      </h1>
      <div class="flex items-center gap-2">
        <span v-if="bulkTranslating" class="text-sm text-stone-500">{{ bulkProgress.done }}/{{ bulkProgress.total }}</span>
        <UButton variant="soft" icon="i-lucide-languages" :loading="bulkTranslating" @click="translateAllProducts">
          Translate all (AI)
        </UButton>
        <UButton variant="soft" icon="i-lucide-sparkles" to="/admin/products/new-ai">
          Create with AI
        </UButton>
        <UButton icon="i-lucide-plus" @click="createModalOpen = true">
          New product
        </UButton>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-end gap-3">
      <UInput v-model="search" placeholder="Search by name…" icon="i-lucide-search" @keyup.enter="load" />
      <USelect
        v-model="status"
        :items="[{ label: 'All statuses', value: '' }, { label: 'Draft', value: 'draft' }, { label: 'Active', value: 'active' }, { label: 'Archived', value: 'archived' }]"
      />
      <UButton variant="soft" @click="load">Search</UButton>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">SKU</th>
            <th class="px-4 py-3">Price</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-8 text-center text-stone-400">Loading…</td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="5" class="px-4 py-8 text-center text-stone-400">No products found.</td>
          </tr>
          <tr v-for="product in rows" :key="product.id" class="border-t border-stone-100">
            <td class="px-4 py-3 font-medium">
              <NuxtLink :to="`/admin/products/${product.id}`" class="hover:underline">{{ product.name }}</NuxtLink>
              <UBadge v-if="product.isFeatured" size="xs" color="primary" variant="subtle" class="ml-2">Featured</UBadge>
              <UBadge v-if="product.layoutStyle === 'landing'" size="xs" color="secondary" variant="subtle" class="ml-2">Landing</UBadge>
            </td>
            <td class="px-4 py-3 text-stone-500">{{ product.sku }}</td>
            <td class="px-4 py-3">{{ formatPrice(product.basePrice) }}</td>
            <td class="px-4 py-3">
              <UBadge :color="statusColor[product.status]" variant="subtle">{{ product.status }}</UBadge>
            </td>
            <td class="px-4 py-3 text-right">
              <UButton size="xs" variant="ghost" :to="`/admin/products/${product.id}`">Edit</UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-stone-500">
      <span>{{ total }} products</span>
      <div class="flex gap-2">
        <UButton size="xs" variant="soft" :disabled="page <= 1" @click="page--">Previous</UButton>
        <UButton size="xs" variant="soft" :disabled="page * pageSize >= total" @click="page++">Next</UButton>
      </div>
    </div>

    <UModal v-model:open="createModalOpen" title="New product">
      <template #body>
        <form class="space-y-4" @submit.prevent="createProduct">
          <UFormField label="Name">
            <UInput v-model="createForm.name" required class="w-full" />
          </UFormField>
          <UFormField label="SKU">
            <UInput v-model="createForm.sku" required class="w-full" />
          </UFormField>
          <UFormField label="Base price (USD)">
            <UInputNumber v-model="createForm.basePrice" :min="0" :step="0.5" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="createModalOpen = false">Cancel</UButton>
            <UButton type="submit" :loading="creating">Create & edit</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
