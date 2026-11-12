<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Hero { title: string, subtitle: string, imageUrl: string | null, ctaLabel: string, ctaHref: string }
interface Promo { title: string, subtitle: string }
interface Settings {
  storeName: string
  tagline: string
  logoUrl: string | null
  accentColor: string
  defaultShippingFee: number
  hero: Hero
  promo: Promo
}

const toast = useToast()
const loading = ref(true)
const saving = ref(false)

const form = reactive({
  storeName: '',
  tagline: '',
  logoUrl: null as string | null,
  accentColor: '#bb6540',
  defaultShippingFee: 0,
  hero: { title: '', subtitle: '', imageUrl: null as string | null, ctaLabel: '', ctaHref: '' },
  promo: { title: '', subtitle: '' },
})

async function load() {
  loading.value = true
  try {
    const settings = await apiFetch<Settings>('/api/admin/settings')
    form.storeName = settings.storeName
    form.tagline = settings.tagline
    form.logoUrl = settings.logoUrl
    form.accentColor = settings.accentColor
    form.defaultShippingFee = settings.defaultShippingFee / 100
    form.hero = { ...settings.hero }
    form.promo = { ...settings.promo }
  }
  catch (e) {
    toast.add({ title: 'Failed to load settings', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await apiFetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        storeName: form.storeName,
        tagline: form.tagline,
        logoUrl: form.logoUrl,
        accentColor: form.accentColor,
        defaultShippingFee: Math.round(form.defaultShippingFee * 100),
        hero: form.hero,
        promo: form.promo,
      },
    })
    toast.add({ title: 'Settings saved', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save settings', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

const uploadingLogo = ref(false)
async function onLogoSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingLogo.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ data: { url: string } }>('/api/admin/settings/images', { method: 'POST', body })
    form.logoUrl = res.data.url
  }
  catch (e) {
    toast.add({ title: 'Logo upload failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    uploadingLogo.value = false
    input.value = ''
  }
}

const uploadingHero = ref(false)
async function onHeroImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingHero.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ data: { url: string } }>('/api/admin/settings/images', { method: 'POST', body })
    form.hero.imageUrl = res.data.url
  }
  catch (e) {
    toast.add({ title: 'Hero image upload failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    uploadingHero.value = false
    input.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Store settings
    </h1>
    <p class="text-sm text-stone-500">
      Branding, homepage hero, and store-wide defaults shown across the storefront.
    </p>

    <div v-if="!loading" class="mt-6 grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header><p class="font-medium">Branding</p></template>
        <form class="space-y-4" @submit.prevent="save">
          <UFormField label="Store name"><UInput v-model="form.storeName" required class="w-full" /></UFormField>
          <UFormField label="Tagline"><UInput v-model="form.tagline" class="w-full" /></UFormField>
          <UFormField label="Accent color">
            <div class="flex items-center gap-2">
              <input v-model="form.accentColor" type="color" class="h-9 w-12 rounded border border-stone-300">
              <UInput v-model="form.accentColor" class="w-full" />
            </div>
          </UFormField>
          <UFormField label="Logo">
            <div class="flex items-center gap-3">
              <div class="flex size-14 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                <img v-if="form.logoUrl" :src="form.logoUrl" alt="Logo" class="h-full w-full object-contain">
                <UIcon v-else name="i-lucide-image" class="size-6 text-stone-300" />
              </div>
              <label>
                <span class="sr-only">Upload logo</span>
                <input type="file" accept="image/*" :disabled="uploadingLogo" class="text-sm" @change="onLogoSelected">
              </label>
            </div>
          </UFormField>
        </form>
      </UCard>

      <UCard>
        <template #header><p class="font-medium">Shipping default</p></template>
        <UFormField label="Default shipping fee (USD)" description="Used when no shipping zones/rates are configured yet.">
          <UInputNumber v-model="form.defaultShippingFee" :min="0" :step="0.5" class="w-full" />
        </UFormField>
      </UCard>

      <UCard class="lg:col-span-2">
        <template #header><p class="font-medium">Homepage hero</p></template>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-4">
            <UFormField label="Title"><UInput v-model="form.hero.title" class="w-full" /></UFormField>
            <UFormField label="Subtitle"><UTextarea v-model="form.hero.subtitle" class="w-full" /></UFormField>
            <UFormField label="CTA label"><UInput v-model="form.hero.ctaLabel" class="w-full" /></UFormField>
            <UFormField label="CTA link"><UInput v-model="form.hero.ctaHref" class="w-full" /></UFormField>
          </div>
          <UFormField label="Hero image">
            <div class="space-y-3">
              <div class="product-media aspect-[16/9] rounded-md">
                <img v-if="form.hero.imageUrl" :src="form.hero.imageUrl" alt="Hero" class="h-full w-full object-cover">
                <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
                  <UIcon name="i-lucide-image" class="size-10" />
                </div>
              </div>
              <label>
                <span class="sr-only">Upload hero image</span>
                <input type="file" accept="image/*" :disabled="uploadingHero" class="text-sm" @change="onHeroImageSelected">
              </label>
            </div>
          </UFormField>
        </div>
      </UCard>

      <UCard class="lg:col-span-2">
        <template #header><p class="font-medium">Promo banner</p></template>
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField label="Title"><UInput v-model="form.promo.title" class="w-full" /></UFormField>
          <UFormField label="Subtitle"><UInput v-model="form.promo.subtitle" class="w-full" /></UFormField>
        </div>
      </UCard>
    </div>

    <p v-else class="mt-6 text-stone-400">Loading…</p>

    <div v-if="!loading" class="mt-6 flex justify-end">
      <UButton size="lg" :loading="saving" @click="save">Save settings</UButton>
    </div>
  </div>
</template>
