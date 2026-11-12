<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Rate {
  id: string
  zoneId: string
  city: string
  fee: number
  isActive: boolean
}
interface Zone {
  id: string
  name: string
  freeShippingThreshold: number | null
  isActive: boolean
  rates: Rate[]
}

const toast = useToast()
const zones = ref<Zone[]>([])
const loading = ref(true)

const zoneModalOpen = ref(false)
const editingZone = ref<Zone | null>(null)
const zoneForm = reactive({ name: '', freeShippingThreshold: null as number | null, isActive: true })
const savingZone = ref(false)

const rateModalOpen = ref(false)
const editingRate = ref<Rate | null>(null)
const rateZoneId = ref('')
const rateForm = reactive({ city: '', fee: 0, isActive: true })
const savingRate = ref(false)

async function load() {
  loading.value = true
  try {
    zones.value = await apiFetch<Zone[]>('/api/admin/shipping/zones')
  }
  catch (e) {
    toast.add({ title: 'Failed to load shipping zones', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function openCreateZone() {
  editingZone.value = null
  zoneForm.name = ''
  zoneForm.freeShippingThreshold = null
  zoneForm.isActive = true
  zoneModalOpen.value = true
}

function openEditZone(zone: Zone) {
  editingZone.value = zone
  zoneForm.name = zone.name
  zoneForm.freeShippingThreshold = zone.freeShippingThreshold ? zone.freeShippingThreshold / 100 : null
  zoneForm.isActive = zone.isActive
  zoneModalOpen.value = true
}

async function saveZone() {
  savingZone.value = true
  try {
    const payload = {
      name: zoneForm.name,
      freeShippingThreshold: zoneForm.freeShippingThreshold != null ? Math.round(zoneForm.freeShippingThreshold * 100) : null,
      isActive: zoneForm.isActive,
    }
    if (editingZone.value) {
      await apiFetch(`/api/admin/shipping/zones/${editingZone.value.id}`, { method: 'PUT', body: payload })
    }
    else {
      await apiFetch('/api/admin/shipping/zones', { method: 'POST', body: payload })
    }
    zoneModalOpen.value = false
    await load()
    toast.add({ title: 'Zone saved', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save zone', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingZone.value = false
  }
}

async function toggleZoneActive(zone: Zone) {
  try {
    await apiFetch(`/api/admin/shipping/zones/${zone.id}`, { method: 'PUT', body: { isActive: !zone.isActive } })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to update zone', description: apiErrorMessage(e), color: 'error' })
  }
}

async function removeZone(zone: Zone) {
  if (!confirm(`Delete zone "${zone.name}" and all its rates?`)) return
  try {
    await apiFetch(`/api/admin/shipping/zones/${zone.id}`, { method: 'DELETE' })
    await load()
    toast.add({ title: 'Zone deleted', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to delete zone', description: apiErrorMessage(e), color: 'error' })
  }
}

function openCreateRate(zone: Zone) {
  editingRate.value = null
  rateZoneId.value = zone.id
  rateForm.city = ''
  rateForm.fee = 0
  rateForm.isActive = true
  rateModalOpen.value = true
}

function openEditRate(rate: Rate) {
  editingRate.value = rate
  rateZoneId.value = rate.zoneId
  rateForm.city = rate.city
  rateForm.fee = rate.fee / 100
  rateForm.isActive = rate.isActive
  rateModalOpen.value = true
}

async function saveRate() {
  savingRate.value = true
  try {
    const payload = { city: rateForm.city, fee: Math.round(rateForm.fee * 100), isActive: rateForm.isActive }
    if (editingRate.value) {
      await apiFetch(`/api/admin/shipping/rates/${editingRate.value.id}`, { method: 'PUT', body: payload })
    }
    else {
      await apiFetch('/api/admin/shipping/rates', { method: 'POST', body: { ...payload, zoneId: rateZoneId.value } })
    }
    rateModalOpen.value = false
    await load()
    toast.add({ title: 'Rate saved', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save rate', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingRate.value = false
  }
}

async function toggleRateActive(rate: Rate) {
  try {
    await apiFetch(`/api/admin/shipping/rates/${rate.id}`, { method: 'PUT', body: { isActive: !rate.isActive } })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to update rate', description: apiErrorMessage(e), color: 'error' })
  }
}

async function removeRate(rate: Rate) {
  if (!confirm(`Delete rate for "${rate.city}"?`)) return
  try {
    await apiFetch(`/api/admin/shipping/rates/${rate.id}`, { method: 'DELETE' })
    await load()
    toast.add({ title: 'Rate deleted', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to delete rate', description: apiErrorMessage(e), color: 'error' })
  }
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl">Shipping</h1>
        <p class="text-sm text-stone-500">
          Manage delivery zones and per-city rates. Destinations without an active rate aren't deliverable at checkout.
        </p>
      </div>
      <UButton icon="i-lucide-plus" @click="openCreateZone">New zone</UButton>
    </div>

    <p v-if="loading" class="mt-6 text-stone-400">Loading…</p>
    <UEmpty
      v-else-if="!zones.length"
      icon="i-lucide-truck"
      title="No shipping zones yet"
      description="Without any zones, checkout falls back to the store's default shipping fee for every city."
      class="mt-10"
    />

    <div v-else class="mt-6 space-y-6">
      <UCard v-for="zone in zones" :key="zone.id">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">
                {{ zone.name }}
                <UBadge v-if="!zone.isActive" size="xs" color="neutral" variant="subtle" class="ml-2">Inactive</UBadge>
              </p>
              <p class="text-xs text-stone-500">
                Free shipping threshold: {{ zone.freeShippingThreshold != null ? formatPrice(zone.freeShippingThreshold) : 'None' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <USwitch :model-value="zone.isActive" @update:model-value="toggleZoneActive(zone)" />
              <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEditZone(zone)" />
              <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeZone(zone)" />
            </div>
          </div>
        </template>

        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th class="py-2">City</th>
              <th class="py-2">Fee</th>
              <th class="py-2">Active</th>
              <th class="py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="!zone.rates.length">
              <td colspan="4" class="py-4 text-center text-stone-400">No cities in this zone yet.</td>
            </tr>
            <tr v-for="rate in zone.rates" :key="rate.id" class="border-t border-stone-100">
              <td class="py-2 font-medium">{{ rate.city }}</td>
              <td class="py-2">{{ formatPrice(rate.fee) }}</td>
              <td class="py-2">
                <USwitch :model-value="rate.isActive" @update:model-value="toggleRateActive(rate)" />
              </td>
              <td class="py-2 text-right">
                <UButton size="xs" variant="ghost" icon="i-lucide-pencil" @click="openEditRate(rate)" />
                <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeRate(rate)" />
              </td>
            </tr>
          </tbody>
        </table>

        <UButton class="mt-3" size="sm" variant="soft" icon="i-lucide-plus" @click="openCreateRate(zone)">
          Add city rate
        </UButton>
      </UCard>
    </div>

    <UModal v-model:open="zoneModalOpen" :title="editingZone ? 'Edit zone' : 'New zone'">
      <template #body>
        <form class="space-y-4" @submit.prevent="saveZone">
          <UFormField label="Name"><UInput v-model="zoneForm.name" required class="w-full" /></UFormField>
          <UFormField label="Free shipping threshold (USD, optional)">
            <UInputNumber v-model="zoneForm.freeShippingThreshold" :min="0" :step="1" class="w-full" />
          </UFormField>
          <UCheckbox v-model="zoneForm.isActive" label="Active" />
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="zoneModalOpen = false">Cancel</UButton>
            <UButton type="submit" :loading="savingZone">Save</UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal v-model:open="rateModalOpen" :title="editingRate ? 'Edit rate' : 'New rate'">
      <template #body>
        <form class="space-y-4" @submit.prevent="saveRate">
          <UFormField label="City"><UInput v-model="rateForm.city" required class="w-full" /></UFormField>
          <UFormField label="Fee (USD)"><UInputNumber v-model="rateForm.fee" :min="0" :step="0.5" class="w-full" /></UFormField>
          <UCheckbox v-model="rateForm.isActive" label="Active" />
          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="ghost" color="neutral" @click="rateModalOpen = false">Cancel</UButton>
            <UButton type="submit" :loading="savingRate">Save</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
