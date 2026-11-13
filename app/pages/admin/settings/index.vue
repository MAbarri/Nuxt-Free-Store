<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Hero { title: string, subtitle: string, imageUrl: string | null, mobileImageUrl: string | null, ctaLabel: string, ctaHref: string }
interface Promo { title: string, subtitle: string }
interface TrustBadge { icon?: string, label: string }
interface Analytics { gaMeasurementId: string | null, fbPixelId: string | null, fbConversionsApiEnabled: boolean }
interface SettingsTranslation {
  tagline?: string | null
  announcementBar?: string | null
  hero?: { title?: string | null, subtitle?: string | null, ctaLabel?: string | null } | null
  promo?: { title?: string | null, subtitle?: string | null } | null
  trustBadges?: Array<{ label: string | null }> | null
}
interface Settings {
  storeName: string
  tagline: string
  logoUrl: string | null
  faviconUrl: string | null
  accentColor: string
  defaultShippingFee: number
  announcementBar: string | null
  hero: Hero
  promo: Promo
  trustBadges: TrustBadge[]
  analytics: Analytics
  translations?: Partial<Record<'en' | 'ar', SettingsTranslation | null>>
}

type TranslatableLocale = 'en' | 'ar'
const LOCALE_LABELS: Record<TranslatableLocale, string> = { en: 'English', ar: 'Arabic' }

const toast = useToast()
const loading = ref(true)
const saving = ref(false)

const form = reactive({
  storeName: '',
  tagline: '',
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  accentColor: '#bb6540',
  defaultShippingFee: 0,
  announcementBar: '' as string | null,
  hero: { title: '', subtitle: '', imageUrl: null as string | null, mobileImageUrl: null as string | null, ctaLabel: '', ctaHref: '' },
  promo: { title: '', subtitle: '' },
  trustBadges: [] as TrustBadge[],
  analytics: { gaMeasurementId: null, fbPixelId: null, fbConversionsApiEnabled: false } as Analytics,
})

// --- Translations (English/Arabic — French is the form above) ---
const activeLocale = ref<TranslatableLocale>('en')
const generatingCopy = ref(false)
const translating = ref<TranslatableLocale | null>(null)
const savingTranslation = ref<TranslatableLocale | null>(null)

interface TranslationForm {
  tagline: string
  announcementBar: string
  heroTitle: string
  heroSubtitle: string
  heroCtaLabel: string
  promoTitle: string
  promoSubtitle: string
  trustBadgeLabels: string[]
}
function emptyTranslationForm(): TranslationForm {
  return { tagline: '', announcementBar: '', heroTitle: '', heroSubtitle: '', heroCtaLabel: '', promoTitle: '', promoSubtitle: '', trustBadgeLabels: [] }
}
const translationForms = reactive<Record<TranslatableLocale, TranslationForm>>({
  en: emptyTranslationForm(),
  ar: emptyTranslationForm(),
})

function applyTranslationToForm(locale: TranslatableLocale, t: SettingsTranslation | null | undefined) {
  translationForms[locale] = {
    tagline: t?.tagline ?? '',
    announcementBar: t?.announcementBar ?? '',
    heroTitle: t?.hero?.title ?? '',
    heroSubtitle: t?.hero?.subtitle ?? '',
    heroCtaLabel: t?.hero?.ctaLabel ?? '',
    promoTitle: t?.promo?.title ?? '',
    promoSubtitle: t?.promo?.subtitle ?? '',
    trustBadgeLabels: t?.trustBadges ? t.trustBadges.map(b => b?.label ?? '') : [],
  }
}

async function load() {
  loading.value = true
  try {
    const settings = await apiFetch<Settings>('/api/admin/settings')
    form.storeName = settings.storeName
    form.tagline = settings.tagline
    form.logoUrl = settings.logoUrl
    form.faviconUrl = settings.faviconUrl
    form.accentColor = settings.accentColor
    form.defaultShippingFee = settings.defaultShippingFee / 100
    form.announcementBar = settings.announcementBar ?? ''
    form.hero = { ...settings.hero }
    form.promo = { ...settings.promo }
    form.trustBadges = settings.trustBadges.map(b => ({ ...b }))
    form.analytics = { ...settings.analytics }

    applyTranslationToForm('en', settings.translations?.en)
    applyTranslationToForm('ar', settings.translations?.ar)
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
        faviconUrl: form.faviconUrl,
        accentColor: form.accentColor,
        defaultShippingFee: Math.round(form.defaultShippingFee * 100),
        announcementBar: form.announcementBar?.trim() || null,
        hero: form.hero,
        promo: form.promo,
        trustBadges: form.trustBadges.filter(b => b.label.trim()).map(b => ({ icon: b.icon || undefined, label: b.label })),
        analytics: {
          gaMeasurementId: form.analytics.gaMeasurementId?.trim() || null,
          fbPixelId: form.analytics.fbPixelId?.trim() || null,
          fbConversionsApiEnabled: form.analytics.fbConversionsApiEnabled,
        },
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

const uploadingFavicon = ref(false)
async function onFaviconSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingFavicon.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ data: { url: string } }>('/api/admin/settings/images', { method: 'POST', body })
    form.faviconUrl = res.data.url
  }
  catch (e) {
    toast.add({ title: 'Favicon upload failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    uploadingFavicon.value = false
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

const uploadingHeroMobile = ref(false)
async function onHeroMobileImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingHeroMobile.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ data: { url: string } }>('/api/admin/settings/images', { method: 'POST', body })
    form.hero.mobileImageUrl = res.data.url
  }
  catch (e) {
    toast.add({ title: 'Mobile hero image upload failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    uploadingHeroMobile.value = false
    input.value = ''
  }
}

function clearHeroMobileImage() {
  form.hero.mobileImageUrl = null
}

function addTrustBadge() {
  if (form.trustBadges.length >= 6) return
  form.trustBadges.push({ icon: '', label: '' })
}
function removeTrustBadge(index: number) {
  form.trustBadges.splice(index, 1)
}

async function aiGenerateFrenchCopy() {
  if (!confirm('Replace the current French homepage copy (tagline, hero, promo, trust badges) with freshly AI-written copy? This saves immediately — you can still edit it afterward.')) return
  generatingCopy.value = true
  try {
    const result = await apiFetch<{ settings: Settings, cost: number }>('/api/admin/settings/ai-generate-copy', { method: 'POST', body: {} })
    form.tagline = result.settings.tagline
    form.announcementBar = result.settings.announcementBar ?? ''
    form.hero = { ...result.settings.hero }
    form.promo = { ...result.settings.promo }
    form.trustBadges = result.settings.trustBadges.map(b => ({ ...b }))
    toast.add({ title: 'Homepage copy generated', description: `AI cost: $${result.cost.toFixed(4)} — review and adjust as needed`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Generation failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    generatingCopy.value = false
  }
}

async function aiTranslateLocale(locale: TranslatableLocale) {
  translating.value = locale
  try {
    const result = await apiFetch<{ translations: Record<string, SettingsTranslation>, cost: number }>(
      '/api/admin/settings/ai-translate',
      { method: 'POST', body: { locales: [locale] } },
    )
    applyTranslationToForm(locale, result.translations[locale])
    toast.add({ title: `Translated into ${LOCALE_LABELS[locale]}`, description: `AI cost: $${result.cost.toFixed(4)} — review before saving`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Translation failed', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    translating.value = null
  }
}

async function saveTranslation(locale: TranslatableLocale) {
  savingTranslation.value = locale
  try {
    const f = translationForms[locale]
    await apiFetch(`/api/admin/settings/translations/${locale}`, {
      method: 'PUT',
      body: {
        tagline: f.tagline || null,
        announcementBar: f.announcementBar || null,
        hero: { title: f.heroTitle || null, subtitle: f.heroSubtitle || null, ctaLabel: f.heroCtaLabel || null },
        promo: { title: f.promoTitle || null, subtitle: f.promoSubtitle || null },
        trustBadges: f.trustBadgeLabels.length ? f.trustBadgeLabels.map(label => ({ label: label || null })) : null,
      },
    })
    toast.add({ title: `${LOCALE_LABELS[locale]} translation saved`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Failed to save translation', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    savingTranslation.value = null
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
          <UFormField label="Favicon" description="Small icon shown in the browser tab. Square image recommended (e.g. 512×512px .png or .ico).">
            <div class="flex items-center gap-3">
              <div class="flex size-14 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                <img v-if="form.faviconUrl" :src="form.faviconUrl" alt="Favicon" class="h-full w-full object-contain">
                <UIcon v-else name="i-lucide-image" class="size-6 text-stone-300" />
              </div>
              <label>
                <span class="sr-only">Upload favicon</span>
                <input type="file" accept="image/*" :disabled="uploadingFavicon" class="text-sm" @change="onFaviconSelected">
              </label>
            </div>
          </UFormField>
          <UFormField label="Announcement bar" description="Shown as a thin bar above the header on every page. Leave empty to hide it.">
            <UInput v-model="form.announcementBar" placeholder="Nouvelle collection · Découvrez votre prochain coup de cœur" class="w-full" />
          </UFormField>
        </form>
      </UCard>

      <UCard>
        <template #header><p class="font-medium">Shipping default</p></template>
        <UFormField label="Default shipping fee (DH)" description="Used when no shipping zones/rates are configured yet.">
          <UInputNumber v-model="form.defaultShippingFee" :min="0" :step="1" :step-snapping="false" class="w-full" />
        </UFormField>
      </UCard>

      <UCard class="lg:col-span-2">
        <template #header><p class="font-medium">Analytics</p></template>
        <p class="text-sm text-stone-500">
          Google Analytics and Facebook Pixel load on the storefront only (never in /admin) once their id is set below.
        </p>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <UFormField label="Google Analytics 4 measurement ID" description="Looks like G-XXXXXXXXXX. Leave empty to disable GA4.">
            <UInput v-model="form.analytics.gaMeasurementId" placeholder="G-XXXXXXXXXX" class="w-full" />
          </UFormField>
          <UFormField label="Facebook Pixel ID" description="Numeric id from Meta Events Manager. Leave empty to disable the Pixel.">
            <UInput v-model="form.analytics.fbPixelId" placeholder="123456789012345" class="w-full" />
          </UFormField>
        </div>
        <UFormField class="mt-4">
          <UCheckbox
            v-model="form.analytics.fbConversionsApiEnabled"
            label="Enable server-side Facebook Conversion API"
            description="Sends a Purchase event straight from our server for every order, in addition to the browser Pixel — more reliable since it isn't affected by ad blockers. Also requires the FB_CONVERSIONS_ACCESS_TOKEN secret to be set (see docs/DEPLOYMENT.md); it quietly does nothing until that's configured, even if enabled here."
          />
        </UFormField>
      </UCard>

      <UCard class="lg:col-span-2">
        <template #header>
          <div class="flex items-center justify-between">
            <p class="font-medium">Homepage hero</p>
            <UButton size="xs" variant="soft" icon="i-lucide-sparkles" :loading="generatingCopy" @click="aiGenerateFrenchCopy">
              Generate French copy with AI
            </UButton>
          </div>
        </template>
        <p class="mb-4 text-sm text-stone-500">
          "Generate French copy" rewrites the tagline, announcement bar, hero, promo banner, and
          trust badge labels below all at once — review and adjust before your visitors see it.
        </p>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-4">
            <UFormField label="Title"><UInput v-model="form.hero.title" class="w-full" /></UFormField>
            <UFormField label="Subtitle"><UTextarea v-model="form.hero.subtitle" class="w-full" /></UFormField>
            <UFormField label="CTA label"><UInput v-model="form.hero.ctaLabel" class="w-full" /></UFormField>
            <UFormField label="CTA link"><UInput v-model="form.hero.ctaHref" class="w-full" /></UFormField>
          </div>
          <div class="space-y-4">
            <UFormField label="Hero image (desktop)">
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
            <UFormField label="Hero image (mobile)" description="Optional. Shown instead of the desktop image on small screens — use this for a photo framed/cropped for a tall, narrow screen. Falls back to the desktop image if left empty.">
              <div class="space-y-3">
                <div class="product-media aspect-[3/4] w-40 rounded-md">
                  <img v-if="form.hero.mobileImageUrl" :src="form.hero.mobileImageUrl" alt="Hero (mobile)" class="h-full w-full object-cover">
                  <div v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
                    <UIcon name="i-lucide-smartphone" class="size-8" />
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <label>
                    <span class="sr-only">Upload mobile hero image</span>
                    <input type="file" accept="image/*" :disabled="uploadingHeroMobile" class="text-sm" @change="onHeroMobileImageSelected">
                  </label>
                  <UButton v-if="form.hero.mobileImageUrl" size="xs" variant="ghost" color="error" @click="clearHeroMobileImage">
                    Remove
                  </UButton>
                </div>
              </div>
            </UFormField>
          </div>
        </div>
      </UCard>

      <UCard class="lg:col-span-2">
        <template #header><p class="font-medium">Promo banner</p></template>
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField label="Title"><UInput v-model="form.promo.title" class="w-full" /></UFormField>
          <UFormField label="Subtitle"><UInput v-model="form.promo.subtitle" class="w-full" /></UFormField>
        </div>
      </UCard>

      <UCard class="lg:col-span-2">
        <template #header>
          <div class="flex items-center justify-between">
            <p class="font-medium">Trust badges</p>
            <UButton size="xs" variant="soft" icon="i-lucide-plus" :disabled="form.trustBadges.length >= 6" @click="addTrustBadge">
              Add badge
            </UButton>
          </div>
        </template>
        <p class="text-sm text-stone-500">
          Shown on every Landing-style product page (e.g. shipping, payment, and exchange policy).
        </p>
        <p v-if="!form.trustBadges.length" class="mt-2 text-sm text-stone-400">
          No trust badges yet.
        </p>
        <div v-for="(badge, i) in form.trustBadges" :key="i" class="mt-3 flex items-center gap-2">
          <UInput v-model="badge.icon" placeholder="◇" class="w-16" />
          <UInput v-model="badge.label" placeholder="Cash on delivery" class="w-full" />
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeTrustBadge(i)" />
        </div>
      </UCard>

      <UCard class="lg:col-span-2">
        <template #header><p class="font-medium">Translations</p></template>
        <p class="text-sm text-stone-500">
          French uses the fields above. Generate English/Arabic with AI, review it, then save —
          visitors browsing in that language see this instead of the French version.
        </p>

        <div class="mt-4 flex gap-2">
          <UButton
            v-for="locale in (['en', 'ar'] as const)" :key="locale"
            size="xs" :variant="activeLocale === locale ? 'solid' : 'soft'"
            @click="activeLocale = locale"
          >
            {{ LOCALE_LABELS[locale] }}
          </UButton>
        </div>

        <div class="mt-4 space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">{{ LOCALE_LABELS[activeLocale] }} content</p>
            <UButton
              size="xs" variant="soft" icon="i-lucide-sparkles"
              :loading="translating === activeLocale"
              @click="aiTranslateLocale(activeLocale)"
            >
              Translate from French
            </UButton>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <UFormField label="Tagline"><UInput v-model="translationForms[activeLocale].tagline" class="w-full" /></UFormField>
            <UFormField label="Announcement bar"><UInput v-model="translationForms[activeLocale].announcementBar" class="w-full" /></UFormField>
            <UFormField label="Hero title"><UInput v-model="translationForms[activeLocale].heroTitle" class="w-full" /></UFormField>
            <UFormField label="Hero CTA label"><UInput v-model="translationForms[activeLocale].heroCtaLabel" class="w-full" /></UFormField>
            <UFormField label="Hero subtitle" class="md:col-span-2"><UTextarea v-model="translationForms[activeLocale].heroSubtitle" class="w-full" /></UFormField>
            <UFormField label="Promo title"><UInput v-model="translationForms[activeLocale].promoTitle" class="w-full" /></UFormField>
            <UFormField label="Promo subtitle"><UInput v-model="translationForms[activeLocale].promoSubtitle" class="w-full" /></UFormField>
          </div>

          <div>
            <p class="text-sm font-medium">Trust badge labels</p>
            <div v-for="(badge, i) in form.trustBadges" :key="i" class="mt-2 flex items-center gap-2">
              <span class="w-8 shrink-0 text-center">{{ badge.icon }}</span>
              <UInput v-model="translationForms[activeLocale].trustBadgeLabels[i]" :placeholder="badge.label" class="w-full" />
            </div>
          </div>

          <div class="flex justify-end">
            <UButton :loading="savingTranslation === activeLocale" @click="saveTranslation(activeLocale)">
              Save {{ LOCALE_LABELS[activeLocale] }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <p v-else class="mt-6 text-stone-400">Loading…</p>

    <div v-if="!loading" class="mt-6 flex justify-end">
      <UButton size="lg" :loading="saving" @click="save">Save settings</UButton>
    </div>
  </div>
</template>
