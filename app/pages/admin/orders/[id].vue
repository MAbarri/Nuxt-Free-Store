<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const orderId = route.params.id as string

interface OrderItem { id: string, productName: string, variantLabel: string | null, sku: string, unitPrice: number, quantity: number, subtotal: number }
interface StatusHistoryEntry { id: string, fromStatus: string | null, toStatus: string, note: string | null, createdAt: string }
interface OrderDetail {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  city: string
  addressLine: string
  deliveryInstructions: string | null
  subtotal: number
  shippingFee: number
  total: number
  status: string
  paymentStatus: string
  trackingReference: string | null
  internalNotes: string | null
  createdAt: string
  items: OrderItem[]
  history: StatusHistoryEntry[]
}

const order = ref<OrderDetail | null>(null)
const loading = ref(true)

const statusOptions = [
  { label: 'Pending confirmation', value: 'pending_confirmation' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Failed delivery', value: 'failed_delivery' },
  { label: 'Returned', value: 'returned' },
]
const paymentStatusOptions = [
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Paid', value: 'paid' },
  { label: 'Refunded', value: 'refunded' },
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

const statusForm = reactive({ status: '', note: '' })
const paymentStatusForm = ref('')
const trackingForm = ref('')
const notesForm = ref('')
const savingStatus = ref(false)
const savingPayment = ref(false)
const savingTracking = ref(false)
const savingNotes = ref(false)

async function load() {
  loading.value = true
  try {
    order.value = await apiFetch<OrderDetail>(`/api/admin/orders/${orderId}`)
    statusForm.status = order.value.status
    statusForm.note = ''
    paymentStatusForm.value = order.value.paymentStatus
    trackingForm.value = order.value.trackingReference ?? ''
    notesForm.value = order.value.internalNotes ?? ''
  }
  catch (e) {
    toast.add({ title: 'Failed to load order', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function saveStatus() {
  savingStatus.value = true
  try {
    await apiFetch(`/api/admin/orders/${orderId}/status`, { method: 'PUT', body: statusForm })
    toast.add({ title: 'Order status updated', color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to update status', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingStatus.value = false
  }
}

async function savePaymentStatus() {
  savingPayment.value = true
  try {
    await apiFetch(`/api/admin/orders/${orderId}/payment-status`, { method: 'PUT', body: { paymentStatus: paymentStatusForm.value } })
    toast.add({ title: 'Payment status updated', color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to update payment status', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingPayment.value = false
  }
}

async function saveTracking() {
  savingTracking.value = true
  try {
    await apiFetch(`/api/admin/orders/${orderId}/tracking`, { method: 'PUT', body: { trackingReference: trackingForm.value } })
    toast.add({ title: 'Tracking reference saved', color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to save tracking reference', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingTracking.value = false
  }
}

async function saveNotes() {
  savingNotes.value = true
  try {
    await apiFetch(`/api/admin/orders/${orderId}/notes`, { method: 'PUT', body: { internalNotes: notesForm.value } })
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

async function cancelOrder() {
  if (!confirm('Cancel this order? Stock will be restored for its items.')) return
  try {
    await apiFetch(`/api/admin/orders/${orderId}/cancel`, { method: 'POST', body: {} })
    toast.add({ title: 'Order cancelled', color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to cancel order', description: apiErrorMessage(e), color: 'error' })
  }
}

onMounted(load)
</script>

<template>
  <div v-if="!loading && order">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl">{{ order.orderNumber }}</h1>
        <p class="text-sm text-stone-500">Placed {{ formatDate(order.createdAt) }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UBadge :color="statusColor[order.status] ?? 'neutral'" variant="subtle">{{ order.status.replace('_', ' ') }}</UBadge>
        <UButton
          v-if="!['cancelled', 'returned'].includes(order.status)"
          size="sm" variant="soft" color="error"
          @click="cancelOrder"
        >
          Cancel order
        </UButton>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <UCard>
          <template #header><p class="font-medium">Items</p></template>
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr><th class="py-2">Product</th><th class="py-2">Unit price</th><th class="py-2">Qty</th><th class="py-2 text-right">Subtotal</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in order.items" :key="item.id" class="border-t border-stone-100">
                <td class="py-2">
                  {{ item.productName }}
                  <span v-if="item.variantLabel" class="text-stone-400"> ({{ item.variantLabel }})</span>
                  <p class="text-xs text-stone-400">SKU: {{ item.sku }}</p>
                </td>
                <td class="py-2">{{ formatPrice(item.unitPrice) }}</td>
                <td class="py-2">{{ item.quantity }}</td>
                <td class="py-2 text-right">{{ formatPrice(item.subtotal) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="mt-4 space-y-1 border-t border-stone-200 pt-4 text-sm">
            <div class="flex justify-between"><span>Subtotal</span><span>{{ formatPrice(order.subtotal) }}</span></div>
            <div class="flex justify-between"><span>Shipping</span><span>{{ formatPrice(order.shippingFee) }}</span></div>
            <div class="flex justify-between text-base font-medium"><span>Total</span><span>{{ formatPrice(order.total) }}</span></div>
          </div>
        </UCard>

        <UCard>
          <template #header><p class="font-medium">Delivery information</p></template>
          <p class="text-sm text-stone-600">
            {{ order.customerName }}<br>
            {{ order.addressLine }}<br>
            {{ order.city }}<br>
            {{ order.customerPhone }}
            <span v-if="order.customerEmail"><br>{{ order.customerEmail }}</span>
          </p>
          <p v-if="order.deliveryInstructions" class="mt-2 text-xs text-stone-400">
            Instructions: {{ order.deliveryInstructions }}
          </p>

          <div class="mt-4 flex items-end gap-2">
            <UFormField label="Tracking reference" class="grow">
              <UInput v-model="trackingForm" class="w-full" placeholder="e.g. carrier tracking number" />
            </UFormField>
            <UButton :loading="savingTracking" @click="saveTracking">Save</UButton>
          </div>
        </UCard>

        <UCard>
          <template #header><p class="font-medium">Internal notes</p></template>
          <UTextarea v-model="notesForm" :rows="3" class="w-full" placeholder="Visible to admins only" />
          <UButton class="mt-3" :loading="savingNotes" @click="saveNotes">Save notes</UButton>
        </UCard>

        <UCard>
          <template #header><p class="font-medium">Status history</p></template>
          <ul class="space-y-3">
            <li v-for="entry in order.history" :key="entry.id" class="flex items-start gap-3 text-sm">
              <UIcon name="i-lucide-circle-dot" class="mt-0.5 size-4 text-stone-400" />
              <div>
                <p>
                  <span v-if="entry.fromStatus">{{ entry.fromStatus.replace('_', ' ') }} → </span>
                  <strong>{{ entry.toStatus.replace('_', ' ') }}</strong>
                </p>
                <p class="text-xs text-stone-400">{{ formatDate(entry.createdAt) }}</p>
                <p v-if="entry.note" class="text-xs text-stone-500">{{ entry.note }}</p>
              </div>
            </li>
          </ul>
        </UCard>
      </div>

      <div class="space-y-6">
        <UCard>
          <template #header><p class="font-medium">Order status</p></template>
          <div class="space-y-3">
            <USelect v-model="statusForm.status" :items="statusOptions" class="w-full" />
            <UInput v-model="statusForm.note" placeholder="Note (optional)" class="w-full" />
            <UButton block :loading="savingStatus" @click="saveStatus">Update status</UButton>
          </div>
        </UCard>

        <UCard>
          <template #header><p class="font-medium">Payment status</p></template>
          <div class="space-y-3">
            <USelect v-model="paymentStatusForm" :items="paymentStatusOptions" class="w-full" />
            <UButton block :loading="savingPayment" @click="savePaymentStatus">Update payment status</UButton>
          </div>
        </UCard>
      </div>
    </div>
  </div>
  <p v-else class="text-stone-400">Loading…</p>
</template>
