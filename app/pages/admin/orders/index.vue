<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface OrderRow {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string
  total: number
  status: string
  paymentStatus: string
  createdAt: string
}

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Pending confirmation', value: 'pending_confirmation' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Failed delivery', value: 'failed_delivery' },
  { label: 'Returned', value: 'returned' },
]

const statusColor: Record<string, string> = {
  pending_confirmation: 'neutral',
  confirmed: 'info',
  processing: 'info',
  shipped: 'primary',
  delivered: 'success',
  cancelled: 'error',
  failed_delivery: 'error',
  returned: 'warning',
}

const toast = useToast()
const rows = ref<OrderRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const search = ref('')
const status = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const result = await apiFetch<{ rows: OrderRow[], total: number }>('/api/admin/orders', {
      query: {
        page: page.value,
        pageSize,
        search: search.value || undefined,
        status: status.value || undefined,
        dateFrom: dateFrom.value || undefined,
        dateTo: dateTo.value || undefined,
      },
    })
    rows.value = result.rows
    total.value = result.total
  }
  catch (e) {
    toast.add({ title: 'Failed to load orders', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

watch([page, status], load)
onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Orders
    </h1>

    <div class="mt-4 flex flex-wrap items-end gap-3">
      <UInput v-model="search" placeholder="Search by reference, name or phone…" icon="i-lucide-search" @keyup.enter="load" />
      <USelect v-model="status" :items="statusOptions" />
      <UFormField label="From">
        <UInput v-model="dateFrom" type="date" @change="load" />
      </UFormField>
      <UFormField label="To">
        <UInput v-model="dateTo" type="date" @change="load" />
      </UFormField>
      <UButton variant="soft" @click="load">Search</UButton>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th class="px-4 py-3">Reference</th>
            <th class="px-4 py-3">Customer</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Payment</th>
            <th class="px-4 py-3">Total</th>
            <th class="px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-stone-400">Loading…</td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="6" class="px-4 py-8 text-center text-stone-400">No orders found.</td>
          </tr>
          <tr v-for="order in rows" :key="order.id" class="border-t border-stone-100">
            <td class="px-4 py-3 font-medium">
              <NuxtLink :to="`/admin/orders/${order.id}`" class="hover:underline">{{ order.orderNumber }}</NuxtLink>
            </td>
            <td class="px-4 py-3">
              {{ order.customerName }}
              <p class="text-xs text-stone-400">{{ order.customerPhone }}</p>
            </td>
            <td class="px-4 py-3">
              <UBadge size="xs" :color="statusColor[order.status] ?? 'neutral'" variant="subtle">{{ order.status.replace('_', ' ') }}</UBadge>
            </td>
            <td class="px-4 py-3">
              <UBadge size="xs" :color="order.paymentStatus === 'paid' ? 'success' : 'neutral'" variant="subtle">{{ order.paymentStatus }}</UBadge>
            </td>
            <td class="px-4 py-3">{{ formatPrice(order.total) }}</td>
            <td class="px-4 py-3 text-stone-500">{{ formatDate(order.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-stone-500">
      <span>{{ total }} orders</span>
      <div class="flex gap-2">
        <UButton size="xs" variant="soft" :disabled="page <= 1" @click="page--">Previous</UButton>
        <UButton size="xs" variant="soft" :disabled="page * pageSize >= total" @click="page++">Next</UButton>
      </div>
    </div>
  </div>
</template>
