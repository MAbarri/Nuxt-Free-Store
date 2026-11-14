import { createError } from 'h3'

/**
 * Minimal Meta Marketing API (Graph API) client — read-only insights/campaigns
 * for the ad account configured in Marketing → Meta ads manager. Requires a
 * System User access token with `ads_read` (see env.d.ts). Kept deliberately
 * thin: this is a dashboard, not a campaign-management tool, so it only ever
 * issues GET requests.
 */
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

async function metaGet<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`)
  url.searchParams.set('access_token', accessToken)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const res = await fetch(url.toString())
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const message = json?.error?.message || `Meta Marketing API request failed (${res.status})`
    throw createError({ statusCode: 502, statusMessage: message })
  }
  return json
}

export interface MetaAdsInsightsSummary {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  reach: number
}

export interface MetaAdsCampaign {
  id: string
  name: string
  status: string
  effectiveStatus: string
  dailyBudget: number | null
  spend: number
}

/** Account-level totals over the last 30 days. */
export async function fetchMetaAdsInsights(params: { adAccountId: string, accessToken: string }): Promise<MetaAdsInsightsSummary> {
  const json = await metaGet<{ data: Array<Record<string, string>> }>(
    `/act_${params.adAccountId}/insights`,
    params.accessToken,
    { date_preset: 'last_30d', fields: 'spend,impressions,clicks,ctr,reach' },
  )
  const row = json.data?.[0]
  return {
    spend: Number(row?.spend ?? 0),
    impressions: Number(row?.impressions ?? 0),
    clicks: Number(row?.clicks ?? 0),
    ctr: Number(row?.ctr ?? 0),
    reach: Number(row?.reach ?? 0),
  }
}

/** Active/recent campaigns with their own last-30-day spend. */
export async function fetchMetaAdsCampaigns(params: { adAccountId: string, accessToken: string }): Promise<MetaAdsCampaign[]> {
  const json = await metaGet<{ data: Array<any> }>(
    `/act_${params.adAccountId}/campaigns`,
    params.accessToken,
    {
      fields: 'id,name,status,effective_status,daily_budget,insights.date_preset(last_30d){spend}',
      limit: '25',
    },
  )
  return (json.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    effectiveStatus: c.effective_status,
    dailyBudget: c.daily_budget ? Number(c.daily_budget) : null,
    spend: Number(c.insights?.data?.[0]?.spend ?? 0),
  }))
}
