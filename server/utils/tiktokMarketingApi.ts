import { createError } from 'h3'

/**
 * Minimal TikTok for Business Marketing API client — read-only insights/
 * campaigns for the advertiser configured in Marketing → TikTok ads manager.
 * Requires an access token for that advertiser (see env.d.ts). Like its Meta
 * counterpart, deliberately read-only — a dashboard, not a management tool.
 */
const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3'

async function tiktokGet<T>(path: string, accessToken: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${TIKTOK_API_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const res = await fetch(url.toString(), { headers: { 'Access-Token': accessToken } })
  const json = await res.json().catch(() => null)
  if (!res.ok || (json && json.code !== undefined && json.code !== 0)) {
    const message = json?.message || `TikTok Marketing API request failed (${res.status})`
    throw createError({ statusCode: 502, statusMessage: message })
  }
  return json
}

function last30DaysRange() {
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

export interface TiktokAdsInsightsSummary {
  spend: number
  impressions: number
  clicks: number
  ctr: number
}

/** Advertiser-level totals over the last 30 days. */
export async function fetchTiktokAdsInsights(params: { advertiserId: string, accessToken: string }): Promise<TiktokAdsInsightsSummary> {
  const { startDate, endDate } = last30DaysRange()
  const json = await tiktokGet<{ data: { list: Array<{ metrics: Record<string, string> }> } }>(
    '/report/integrated/get/',
    params.accessToken,
    {
      advertiser_id: params.advertiserId,
      report_type: 'BASIC',
      data_level: 'AUCTION_ADVERTISER',
      dimensions: JSON.stringify(['advertiser_id']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr']),
      start_date: startDate,
      end_date: endDate,
    },
  )
  const metrics = json.data?.list?.[0]?.metrics
  return {
    spend: Number(metrics?.spend ?? 0),
    impressions: Number(metrics?.impressions ?? 0),
    clicks: Number(metrics?.clicks ?? 0),
    ctr: Number(metrics?.ctr ?? 0),
  }
}

export interface TiktokAdsCampaign {
  id: string
  name: string
  status: string
  budget: number | null
}

/** Active/recent campaigns (spend isn't broken out per-campaign here to keep this to a single call — the account-level summary above covers total spend). */
export async function fetchTiktokAdsCampaigns(params: { advertiserId: string, accessToken: string }): Promise<TiktokAdsCampaign[]> {
  const json = await tiktokGet<{ data: { list: Array<any> } }>(
    '/campaign/get/',
    params.accessToken,
    { advertiser_id: params.advertiserId, page_size: '25' },
  )
  return (json.data?.list ?? []).map((c: any) => ({
    id: c.campaign_id,
    name: c.campaign_name,
    status: c.operation_status,
    budget: c.budget ? Number(c.budget) : null,
  }))
}
