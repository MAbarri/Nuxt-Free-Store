<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const customerId = route.params.id as string

interface Address { id: string, label: string | null, fullName: string, phone: string, city: string, addressLine: string, isDefault: boolean }
interface OrderRow { id: string, orderNumber: string, status: string, paymentStatus: string, total: number, createdAt: string }
interface CustomerDetail {
  profileId: string
  fullName: string | null
  email: string
  phone: string | null
  notes: string | null
  createdAt: string
  totalOrders: number
  totalSpent: number
  addresses: Address[]
  orders: OrderRow[]
}

const customer = ref<CustomerDetail | null>(null)
const loading = ref(true)
const notesForm = ref('')
const savingNotes = ref(false)

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

async function load() {
  loading.value = true
  try {
    customer.value = await apiFetch<CustomerDetail>(`/api/admin/customers/${customerId}`)
    notesForm.value = customer.value.notes ?? ''
  }
  catch (e) {
    toast.add({ title: 'Failed to load customer', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function saveNotes() {
  savingNotes.value = true
  try {
    await apiFetch(`/api/admin/customers/${customerId}/notes`, { method: 'PUT', body: { notes: notesForm.value } })
    toast.add({ title: 'Notes saved', color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to save notes', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingNotes.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(load)
</script>

<template>
  <div v-if="!loading && customer">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl">{{ customer.fullName || 'Unnamed customer' }}</h1>
        <p class="text-sm text-stone-500">Customer since {{ formatDate(customer.createdAt) }}</p>
      </div>
    </div>

    <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <UCard>
        <p class="text-xs uppercase tracking-wide text-stone-500">Total orders</p>
        <p class="mt-2 font-display text-2xl">{{ customer.totalOrders }}</p>
      </UCard>
      <UCard>
        <p class="text-xs uppercase tracking-wide text-stone-500">Total spent</p>
        <p class="mt-2 font-display text-2xl">{{ formatPrice(customer.totalSpent) }}</p>
      </UCard>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <UCard>
          <template #header><p class="font-medium">Order history</p></template>
          <table class="w-full text-sm">
            <tbody>
              <tr v-if="!customer.orders.length">
                <td class="py-6 text-center text-stone-400">No orders yet.</td>
              </tr>
              <tr v-for="order in customer.orders" :key="order.id" class="border-t border-stone-100 first:border-t-0">
                <td class="py-2">
                  <NuxtLink :to="`/admin/orders/${order.id}`" class="font-medium hover:underline">{{ order.orderNumber }}</NuxtLink>
                  <p class="text-xs text-stone-400">{{ formatDate(order.createdAt) }}</p>
                </td>
                <td class="py-2 text-right">
                  <UBadge size="xs" :color="statusColor[order.status] ?? 'neutral'" variant="subtle">{{ order.status.replace('_', ' ') }}</UBadge>
                </td>
                <td class="py-2 pl-3 text-right font-medium">{{ formatPrice(order.total) }}</td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <UCard>
          <template #header><p class="font-medium">Addresses</p></template>
          <div v-if="!customer.addresses.length" class="py-6 text-center text-stone-400">
            No saved addresses.
          </div>
          <ul v-else class="space-y-3">
            <li v-for="address in customer.addresses" :key="address.id" class="rounded-md border border-stone-100 p-3 text-sm">
              <p class="font-medium">
                {{ address.label || 'Address' }}
                <UBadge v-if="address.isDefault" size="xs" color="primary" variant="subtle" class="ml-1">Default</UBadge>
              </p>
              <p class="text-stone-500">{{ address.fullName }} · {{ address.phone }}</p>
              <p class="text-stone-500">{{ address.addressLine }}, {{ address.city }}</p>
            </li>
          </ul>
        </UCard>
      </div>

      <div class="space-y-6">
        <UCard>
          <template #header><p class="font-medium">Contact information</p></template>
          <p class="text-sm text-stone-600">
            {{ customer.email }}<br>
            <span v-if="customer.phone">{{ customer.phone }}</span>
          </p>
        </UCard>

        <UCard>
          <template #header><p class="font-medium">Internal notes</p></template>
          <UTextarea v-model="notesForm" :rows="4" class="w-full" placeholder="Notes visible to admins only" />
          <UButton class="mt-3" block :loading="savingNotes" @click="saveNotes">Save notes</UButton>
        </UCard>
      </div>
    </div>
  </div>
  <p v-else class="text-stone-400">Loading…</p>
</template>
