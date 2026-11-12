<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface VariantAttr { attributeName: string, value: string }
interface VariantRow {
  variantId: string
  sku: string
  price: number | null
  stock: number
  isActive: boolean
  productId: string
  productName: string
  productSlug: string
  productStatus: string
  basePrice: number
  attributes: VariantAttr[]
}
interface Adjustment {
  id: string
  changeQty: number
  resultingStock: number
  reason: string
  note: string | null
  createdAt: string
}

const toast = useToast()
const rows = ref<VariantRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const search = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const result = await apiFetch<{ rows: VariantRow[], total: number }>('/api/admin/inventory', {
      query: { page: page.value, pageSize, search: search.value || undefined },
    })
    rows.value = result.rows
    total.value = result.total
  }
  catch (e) {
    toast.add({ title: 'Failed to load inventory', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function variantLabel(variant: VariantRow) {
  return variant.attributes.map(a => `${a.attributeName}: ${a.value}`).join(' / ') || '—'
}
function formatPrice(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}
function stockColor(stock: number) {
  if (stock <= 0) return 'error'
  if (stock <= 5) return 'warning'
  return 'success'
}

// --- Stock adjustment ---
const adjustModalOpen = ref(false)
const adjustingVariant = ref<VariantRow | null>(null)
const adjustForm = reactive({ delta: 0, reason: 'restock' as 'restock' | 'manual_adjustment', note: '' })
const adjusting = ref(false)

function openAdjust(variant: VariantRow) {
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
    toast.add({ title: 'Stock adjusted', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Adjustment failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    adjusting.value = false
  }
}

// --- History ---
const historyModalOpen = ref(false)
const historyVariant = ref<VariantRow | null>(null)
const history = ref<Adjustment[]>([])
const historyLoading = ref(false)

async function openHistory(variant: VariantRow) {
  historyVariant.value = variant
  historyModalOpen.value = true
  historyLoading.value = true
  try {
    history.value = await apiFetch<Adjustment[]>(`/api/admin/inventory/variants/${variant.variantId}/history`)
  }
  catch (e) {
    toast.add({ title: 'Failed to load history', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    historyLoading.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

watch(page, load)
onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Inventory
    </h1>

    <div class="mt-4 flex items-end gap-3">
      <UInput v-model="search" placeholder="Search by product name or SKU…" icon="i-lucide-search" @keyup.enter="load" />
      <UButton variant="soft" @click="load">Search</UButton>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th class="px-4 py-3">Product</th>
            <th class="px-4 py-3">SKU</th>
            <th class="px-4 py-3">Attributes</th>
            <th class="px-4 py-3">Price</th>
            <th class="px-4 py-3">Stock</th>
            <th class="px-4 py-3">Active</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-8 text-center text-stone-400">Loading…</td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="7" class="px-4 py-8 text-center text-stone-400">No variants found.</td>
          </tr>
          <tr v-for="variant in rows" :key="variant.variantId" class="border-t border-stone-100">
            <td class="px-4 py-3 font-medium">
              <NuxtLink :to="`/admin/products/${variant.productId}`" class="hover:underline">{{ variant.productName }}</NuxtLink>
            </td>
            <td class="px-4 py-3 text-stone-500">{{ variant.sku }}</td>
            <td class="px-4 py-3 text-stone-500">{{ variantLabel(variant) }}</td>
            <td class="px-4 py-3">{{ formatPrice(variant.price ?? variant.basePrice) }}</td>
            <td class="px-4 py-3">
              <UBadge size="xs" :color="stockColor(variant.stock)" variant="subtle">{{ variant.stock }}</UBadge>
            </td>
            <td class="px-4 py-3">
              <UBadge size="xs" :color="variant.isActive ? 'success' : 'neutral'" variant="subtle">
                {{ variant.isActive ? 'Active' : 'Inactive' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-right">
              <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openAdjust(variant)" />
              <UButton size="xs" variant="ghost" icon="i-lucide-history" @click="openHistory(variant)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-stone-500">
      <span>{{ total }} variants</span>
      <div class="flex gap-2">
        <UButton size="xs" variant="soft" :disabled="page <= 1" @click="page--">Previous</UButton>
        <UButton size="xs" variant="soft" :disabled="page * pageSize >= total" @click="page++">Next</UButton>
      </div>
    </div>

    <UModal v-model:open="adjustModalOpen" title="Adjust stock">
      <template #body>
        <form class="space-y-4" @submit.prevent="submitAdjust">
          <p class="text-sm text-stone-500">
            {{ adjustingVariant?.productName }} — {{ adjustingVariant?.sku }} — current stock: {{ adjustingVariant?.stock }}
          </p>
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

    <UModal v-model:open="historyModalOpen" :title="`Adjustment history — ${historyVariant?.sku ?? ''}`">
      <template #body>
        <p v-if="historyLoading" class="text-stone-400">Loading…</p>
        <p v-else-if="!history.length" class="text-stone-400">No adjustments recorded yet.</p>
        <table v-else class="w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th class="py-2">Date</th>
              <th class="py-2">Change</th>
              <th class="py-2">Resulting stock</th>
              <th class="py-2">Reason</th>
              <th class="py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="adj in history" :key="adj.id" class="border-t border-stone-100">
              <td class="py-2 text-stone-500">{{ formatDate(adj.createdAt) }}</td>
              <td class="py-2" :class="adj.changeQty < 0 ? 'text-red-600' : 'text-green-700'">
                {{ adj.changeQty > 0 ? `+${adj.changeQty}` : adj.changeQty }}
              </td>
              <td class="py-2">{{ adj.resultingStock }}</td>
              <td class="py-2 text-stone-500">{{ adj.reason.replace('_', ' ') }}</td>
              <td class="py-2 text-stone-500">{{ adj.note ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </UModal>
  </div>
</template>
