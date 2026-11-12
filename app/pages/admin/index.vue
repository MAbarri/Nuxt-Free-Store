<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Overview {
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  awaitingConfirmation: number
  deliveredOrders: number
  recentOrders: Array<{ id: string, orderNumber: string, customerName: string, total: number, status: string, paymentStatus: string, createdAt: string }>
  bestSellers: Array<{ productId: string, name: string, quantitySold: number }>
  lowStock: Array<{ variantId: string, sku: string, stock: number, productId: string, productName: string }>
}

const toast = useToast()
const overview = ref<Overview | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    overview.value = await apiFetch<Overview>('/api/admin/dashboard')
  }
  catch (e) {
    toast.add({ title: 'Failed to load dashboard', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

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

onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Overview
    </h1>

    <div v-if="loading" class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
      <USkeleton v-for="i in 5" :key="i" class="h-24" />
    </div>

    <template v-else-if="overview">
      <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <UCard>
          <p class="text-xs uppercase tracking-wide text-stone-500">Total orders</p>
          <p class="mt-2 font-display text-2xl">{{ overview.totalOrders }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-stone-500">Total revenue</p>
          <p class="mt-2 font-display text-2xl">{{ formatPrice(overview.totalRevenue) }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-stone-500">Pending orders</p>
          <p class="mt-2 font-display text-2xl">{{ overview.pendingOrders }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-stone-500">Awaiting confirmation</p>
          <p class="mt-2 font-display text-2xl">{{ overview.awaitingConfirmation }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-stone-500">Delivered</p>
          <p class="mt-2 font-display text-2xl">{{ overview.deliveredOrders }}</p>
        </UCard>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <p class="font-medium">Recent orders</p>
              <UButton size="xs" variant="ghost" to="/admin/orders">View all</UButton>
            </div>
          </template>
          <table class="w-full text-sm">
            <tbody>
              <tr v-if="!overview.recentOrders.length">
                <td class="py-6 text-center text-stone-400">No orders yet.</td>
              </tr>
              <tr v-for="order in overview.recentOrders" :key="order.id" class="border-t border-stone-100 first:border-t-0">
                <td class="py-2">
                  <NuxtLink :to="`/admin/orders/${order.id}`" class="font-medium hover:underline">{{ order.orderNumber }}</NuxtLink>
                  <p class="text-xs text-stone-400">{{ order.customerName }} · {{ formatDate(order.createdAt) }}</p>
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
          <template #header>
            <p class="font-medium">Best-selling products</p>
          </template>
          <table class="w-full text-sm">
            <tbody>
              <tr v-if="!overview.bestSellers.length">
                <td class="py-6 text-center text-stone-400">No sales yet.</td>
              </tr>
              <tr v-for="item in overview.bestSellers" :key="item.productId" class="border-t border-stone-100 first:border-t-0">
                <td class="py-2">{{ item.name }}</td>
                <td class="py-2 text-right text-stone-500">{{ item.quantitySold }} sold</td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <UCard class="lg:col-span-2">
          <template #header>
            <div class="flex items-center justify-between">
              <p class="font-medium">Low stock</p>
              <UButton size="xs" variant="ghost" to="/admin/inventory">View inventory</UButton>
            </div>
          </template>
          <table class="w-full text-sm">
            <tbody>
              <tr v-if="!overview.lowStock.length">
                <td class="py-6 text-center text-stone-400">Nothing low on stock.</td>
              </tr>
              <tr v-for="row in overview.lowStock" :key="row.variantId" class="border-t border-stone-100 first:border-t-0">
                <td class="py-2">
                  <NuxtLink :to="`/admin/products/${row.productId}`" class="hover:underline">{{ row.productName }}</NuxtLink>
                  <p class="text-xs text-stone-400">{{ row.sku }}</p>
                </td>
                <td class="py-2 text-right">
                  <UBadge size="xs" :color="row.stock === 0 ? 'error' : 'warning'" variant="subtle">{{ row.stock }} left</UBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </UCard>
      </div>
    </template>
  </div>
</template>
