<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Overview {
  totalOrders: number
  totalRevenue: number
  analytics: {
    gaConnected: boolean
    fbPixelConnected: boolean
    fbConversionsApiConnected: boolean
  }
  metaAds: { connected: boolean }
  tiktokAds: { connected: boolean }
}

const toast = useToast()
const overview = ref<Overview | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    overview.value = await apiFetch<Overview>('/api/admin/marketing/overview')
  }
  catch (e) {
    toast.add({ title: 'Failed to load marketing overview', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      Marketing
    </h1>
    <p class="text-sm text-stone-500">
      Analytics connection status, ad platform connections, and shortcuts to the marketing tools below.
    </p>

    <div v-if="loading" class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <USkeleton v-for="i in 4" :key="i" class="h-20" />
    </div>

    <template v-else-if="overview">
      <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <UCard>
          <p class="text-xs uppercase tracking-wide text-stone-500">Total orders</p>
          <p class="mt-2 font-display text-2xl">{{ overview.totalOrders }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-stone-500">Total revenue</p>
          <p class="mt-2 font-display text-2xl">{{ formatPrice(overview.totalRevenue) }}</p>
        </UCard>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <p class="font-medium">Analytics</p>
              <UButton size="xs" variant="ghost" to="/admin/settings">Configure</UButton>
            </div>
          </template>
          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span>Google Analytics 4</span>
              <UBadge size="xs" :color="overview.analytics.gaConnected ? 'success' : 'neutral'" variant="subtle">
                {{ overview.analytics.gaConnected ? 'Connected' : 'Not connected' }}
              </UBadge>
            </div>
            <div class="flex items-center justify-between">
              <span>Facebook Pixel</span>
              <UBadge size="xs" :color="overview.analytics.fbPixelConnected ? 'success' : 'neutral'" variant="subtle">
                {{ overview.analytics.fbPixelConnected ? 'Connected' : 'Not connected' }}
              </UBadge>
            </div>
            <div class="flex items-center justify-between">
              <span>Facebook Conversion API</span>
              <UBadge size="xs" :color="overview.analytics.fbConversionsApiConnected ? 'success' : 'neutral'" variant="subtle">
                {{ overview.analytics.fbConversionsApiConnected ? 'Connected' : 'Not connected' }}
              </UBadge>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header><p class="font-medium">Ad platforms</p></template>
          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span>Meta ads manager</span>
              <div class="flex items-center gap-2">
                <UBadge size="xs" :color="overview.metaAds.connected ? 'success' : 'neutral'" variant="subtle">
                  {{ overview.metaAds.connected ? 'Connected' : 'Not connected' }}
                </UBadge>
                <UButton size="xs" variant="ghost" to="/admin/marketing/meta-ads">Open</UButton>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span>TikTok ads manager</span>
              <div class="flex items-center gap-2">
                <UBadge size="xs" :color="overview.tiktokAds.connected ? 'success' : 'neutral'" variant="subtle">
                  {{ overview.tiktokAds.connected ? 'Connected' : 'Not connected' }}
                </UBadge>
                <UButton size="xs" variant="ghost" to="/admin/marketing/tiktok-ads">Open</UButton>
              </div>
            </div>
          </div>
        </UCard>

        <UCard class="lg:col-span-2">
          <template #header><p class="font-medium">Social media post generator</p></template>
          <p class="text-sm text-stone-500">
            Write a ready-to-post Instagram, Facebook, or TikTok caption (with hashtags) for any product, in French, English, or Arabic — powered by AI.
          </p>
          <UButton class="mt-4" icon="i-lucide-sparkles" to="/admin/marketing/social-posts">
            Open social post generator
          </UButton>
        </UCard>
      </div>
    </template>
  </div>
</template>
