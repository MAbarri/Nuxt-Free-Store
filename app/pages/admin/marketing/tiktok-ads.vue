<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Insights { spend: number, impressions: number, clicks: number, ctr: number }
interface Campaign { id: string, name: string, status: string, budget: number | null }
interface InsightsResponse {
  connected: boolean
  insights?: Insights
  campaigns?: Campaign[]
}

const toast = useToast()
const loading = ref(true)
const data = ref<InsightsResponse | null>(null)

const advertiserId = ref('')
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    const [config, insights] = await Promise.all([
      apiFetch<{ tiktokAdvertiserId: string | null }>('/api/admin/marketing/config'),
      apiFetch<InsightsResponse>('/api/admin/marketing/tiktok-ads/insights'),
    ])
    advertiserId.value = config.tiktokAdvertiserId ?? ''
    data.value = insights
  }
  catch (e) {
    toast.add({ title: 'Failed to load TikTok ads data', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function saveAdvertiserId() {
  saving.value = true
  try {
    await apiFetch('/api/admin/marketing/config', {
      method: 'PUT',
      body: { tiktokAdvertiserId: advertiserId.value.trim() || null },
    })
    toast.add({ title: 'Advertiser saved', color: 'success' })
    await load()
  }
  catch (e) {
    toast.add({ title: 'Failed to save', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <h1 class="font-display text-2xl">
      TikTok ads manager
    </h1>
    <p class="text-sm text-stone-500">
      Read-only spend and campaign overview from TikTok's Marketing API, for the advertiser below. Campaigns are still created and managed in TikTok Ads Manager itself.
    </p>

    <div v-if="loading" class="mt-6">
      <USkeleton class="h-32" />
    </div>

    <template v-else>
      <UCard class="mt-6">
        <template #header><p class="font-medium">Connection</p></template>
        <div class="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <UFormField label="TikTok advertiser ID" description="From TikTok for Business → Assets → Advertiser info.">
            <UInput v-model="advertiserId" placeholder="1234567890123456789" class="w-full" />
          </UFormField>
          <UButton :loading="saving" @click="saveAdvertiserId">Save</UButton>
        </div>
        <p v-if="!data?.connected" class="mt-4 text-sm text-stone-500">
          Also requires a <code>TIKTOK_ADS_ACCESS_TOKEN</code> secret (an access token for this advertiser) — see
          <code>docs/DEPLOYMENT.md</code>. Until both are set, this page stays in "not connected" mode.
        </p>
      </UCard>

      <template v-if="data?.connected && data.insights">
        <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <UCard>
            <p class="text-xs uppercase tracking-wide text-stone-500">Spend (30d)</p>
            <p class="mt-2 font-display text-2xl">{{ data.insights.spend.toFixed(2) }} DH</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-stone-500">Impressions</p>
            <p class="mt-2 font-display text-2xl">{{ data.insights.impressions.toLocaleString() }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-stone-500">Clicks</p>
            <p class="mt-2 font-display text-2xl">{{ data.insights.clicks.toLocaleString() }}</p>
          </UCard>
          <UCard>
            <p class="text-xs uppercase tracking-wide text-stone-500">CTR</p>
            <p class="mt-2 font-display text-2xl">{{ data.insights.ctr.toFixed(2) }}%</p>
          </UCard>
        </div>

        <UCard class="mt-6">
          <template #header><p class="font-medium">Campaigns</p></template>
          <table class="w-full text-sm">
            <tbody>
              <tr v-if="!data.campaigns?.length">
                <td class="py-6 text-center text-stone-400">No campaigns found.</td>
              </tr>
              <tr v-for="c in data.campaigns" :key="c.id" class="border-t border-stone-100 first:border-t-0">
                <td class="py-2">
                  <p class="font-medium">{{ c.name }}</p>
                  <p class="text-xs text-stone-400">{{ c.status }}</p>
                </td>
                <td class="py-2 text-right font-medium">
                  {{ c.budget != null ? `${c.budget.toFixed(2)} DH/day` : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </UCard>
      </template>

      <UCard v-else class="mt-6">
        <div class="flex flex-col items-center gap-2 py-8 text-center">
          <UIcon name="i-lucide-music-2" class="size-10 text-stone-300" />
          <p class="font-medium">Not connected yet</p>
          <p class="max-w-md text-sm text-stone-500">
            Set the advertiser ID above and the <code>TIKTOK_ADS_ACCESS_TOKEN</code> secret to see spend and campaigns here.
          </p>
        </div>
      </UCard>
    </template>
  </div>
</template>
