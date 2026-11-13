<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface CustomerRow {
  profileId: string
  userId: string
  fullName: string | null
  email: string
  phone: string | null
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

watch(page, load)
onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Customers
    </h1>

    <div class="mt-4 flex items-end gap-3">
      <UInput v-model="search" placeholder="Search by name, email or phone…" icon="i-lucide-search" @keyup.enter="load" />
      <UButton variant="soft" @click="load">Search</UButton>
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
            <td colspan="4" class="px-4 py-8 text-center text-stone-400">No customers found.</td>
          </tr>
          <tr v-for="customer in rows" :key="customer.profileId" class="border-t border-stone-100">
            <td class="px-4 py-3 font-medium">
              <NuxtLink :to="`/admin/customers/${customer.profileId}`" class="hover:underline">
                {{ customer.fullName || 'Unnamed customer' }}
              </NuxtLink>
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
