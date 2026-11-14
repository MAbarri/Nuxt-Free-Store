<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface CustomerRow {
  profileId: string
  userId: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  hasAccount: boolean
  totalOrders: number
  totalSpent: number
}

const toast = useToast()
const rows = ref<CustomerRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const search = ref('')
const loading = ref(true)
const backfilling = ref(false)

async function load() {
  loading.value = true
  try {
    const result = await apiFetch<{ rows: CustomerRow[], total: number }>('/api/admin/customers', {
      query: { page: page.value, pageSize, search: search.value || undefined },
    })
    rows.value = result.rows
    total.value = result.total
  }
  catch (e) {
    toast.add({ title: 'Failed to load customers', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function backfill() {
  backfilling.value = true
  try {
    const result = await apiFetch<{ ordersUpdated: number, profilesCreated: number }>('/api/admin/customers/backfill', { method: 'POST' })
    toast.add({
      title: 'Backfill complete',
      description: `${result.profilesCreated} customer(s) created from ${result.ordersUpdated} order(s).`,
      color: 'success',
    })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Backfill failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    backfilling.value = false
  }
}

watch(page, load)
onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Customers
    </h1>

    <div class="mt-4 flex flex-wrap items-end gap-3">
      <UInput v-model="search" placeholder="Search by name, email or phone…" icon="i-lucide-search" @keyup.enter="load" />
      <UButton variant="soft" @click="load">Search</UButton>
      <UButton variant="ghost" icon="i-lucide-refresh-ccw" :loading="backfilling" @click="backfill">
        Backfill from orders
      </UButton>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
      <table class="w-full text-sm">
        <thead class="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3">Contact</th>
            <th class="px-4 py-3">Orders</th>
            <th class="px-4 py-3">Total spent</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-8 text-center text-stone-400">Loading…</td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="4" class="px-4 py-8 text-center text-stone-400">
              <p>No customers found.</p>
              <UButton class="mt-3" size="sm" variant="soft" :loading="backfilling" @click="backfill">
                No customers yet — backfill from existing orders
              </UButton>
            </td>
          </tr>
          <tr v-for="customer in rows" :key="customer.profileId" class="border-t border-stone-100">
            <td class="px-4 py-3 font-medium">
              <NuxtLink :to="`/admin/customers/${customer.profileId}`" class="hover:underline">
                {{ customer.fullName || 'Unnamed customer' }}
              </NuxtLink>
              <UBadge size="xs" :color="customer.hasAccount ? 'primary' : 'neutral'" variant="subtle" class="ml-2">
                {{ customer.hasAccount ? 'Has account' : 'Guest' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 text-stone-500">
              {{ customer.email }}
              <p v-if="customer.phone" class="text-xs text-stone-400">{{ customer.phone }}</p>
            </td>
            <td class="px-4 py-3">{{ customer.totalOrders }}</td>
            <td class="px-4 py-3">{{ formatPrice(customer.totalSpent) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-stone-500">
      <span>{{ total }} customers</span>
      <div class="flex gap-2">
        <UButton size="xs" variant="soft" :disabled="page <= 1" @click="page--">Previous</UButton>
        <UButton size="xs" variant="soft" :disabled="page * pageSize >= total" @click="page++">Next</UButton>
      </div>
    </div>
  </div>
</template>
