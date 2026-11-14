<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Insights { spend: number, impressions: number, clicks: number, ctr: number, reach: number }
interface Campaign { id: string, name: string, status: string, effectiveStatus: string, dailyBudget: number | null, spend: number }
interface InsightsResponse {
  connected: boolean
  insights?: Insights
  campaigns?: Campaign[]
}

const toast = useToast()
const loading = ref(true)
const data = ref<InsightsResponse | null>(null)

const adAccountId = ref('')
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    const [config, insights] = await Promise.all([
      apiFetch<{ metaAdAccountId: string | null }>('/api/admin/marketing/config'),
      apiFetch<InsightsResponse>('/api/admin/marketing/meta-ads/insights'),
    ])
    adAccountId.value = config.metaAdAccountId ?? ''
    data.value = insights
  }
  catch (e) {
    toast.add({ title: 'Failed to load Meta ads data', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function saveAdAccountId() {
  saving.value = true
  try {
    await apiFetch('/api/admin/marketing/config', {
      method: 'PUT',
      body: { metaAdAccountId: adAccountId.value.trim() || null },
    })
    toast.add({ title: 'Ad account saved', color: 'success' })
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
      Meta ads manager
    </h1>
    <p class="text-sm text-stone-500">
      Read-only spend and campaign overview from Meta's Marketing API, for the ad account below. Campaigns are still created and managed in Meta Ads Manager itself.
    </p>

    <div v-if="loading" class="mt-6">
      <USkeleton class="h-32" />
    </div>

    <template v-else>
      <UCard class="mt-6">
        <template #header><p class="font-medium">Connection</p></template>
        <div class="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <UFormField label="Meta ad account ID" description="Numeric id from Business Manager (without the act_ prefix).">
            <UInput v-model="adAccountId" placeholder="123456789012345" class="w-full" />
          </UFormField>
          <UButton :loading="saving" @click="saveAdAccountId">Save</UButton>
        </div>
        <p v-if="!data?.connected" class="mt-4 text-sm text-stone-500">
          Also requires a <code>META_ADS_ACCESS_TOKEN</code> secret (a Marketing API System User access token with
          <code>ads_read</code> on this account) — see <code>docs/DEPLOYMENT.md</code>. Until both are set, this page stays
          in "not connected" mode.
        </p>
      </UCard>

      <template v-if="data?.connected && data.insights">
        <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
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
          <UCard>
            <p class="text-xs uppercase tracking-wide text-stone-500">Reach</p>
            <p class="mt-2 font-display text-2xl">{{ data.insights.reach.toLocaleString() }}</p>
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
                  <p class="text-xs text-stone-400">{{ c.effectiveStatus }}</p>
                </td>
                <td class="py-2 text-right text-stone-500">
                  {{ c.dailyBudget != null ? `${(c.dailyBudget / 100).toFixed(2)} DH/day` : '—' }}
                </td>
                <td class="py-2 pl-3 text-right font-medium">{{ c.spend.toFixed(2) }} DH</td>
              </tr>
            </tbody>
          </table>
        </UCard>
      </template>

      <UCard v-else class="mt-6">
        <div class="flex flex-col items-center gap-2 py-8 text-center">
          <UIcon name="i-lucide-facebook" class="size-10 text-stone-300" />
          <p class="font-medium">Not connected yet</p>
          <p class="max-w-md text-sm text-stone-500">
            Set the ad account ID above and the <code>META_ADS_ACCESS_TOKEN</code> secret to see spend and campaigns here.
          </p>
        </div>
      </UCard>
    </template>
  </div>
</template>
