import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { useDb } from '../utils/db'
import { storeSettings } from '../database/schema'
import { settingsService } from './settings.service'
import { dashboardService } from './dashboard.service'
import { productsService } from './products.service'
import { generateSocialPost } from '../utils/openrouter'
import { fetchMetaAdsInsights, fetchMetaAdsCampaigns } from '../utils/metaMarketingApi'
import { fetchTiktokAdsInsights, fetchTiktokAdsCampaigns } from '../utils/tiktokMarketingApi'

// Ad account/advertiser ids live in the same store_settings key-value table
// as the rest of the store config, but under a `marketing_` prefix that
// settingsService.getBase() explicitly excludes — these are admin-only
// identifiers, never part of the public/storefront settings payload.
const META_CONFIG_KEY = 'marketing_meta_ads'
const TIKTOK_CONFIG_KEY = 'marketing_tiktok_ads'

interface MetaAdsConfig { adAccountId: string | null }
interface TiktokAdsConfig { advertiserId: string | null }

async function readConfig<T>(event: H3Event, key: string, fallback: T): Promise<T> {
  const db = useDb(event)
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1)
  return (row?.value as T) ?? fallback
}

async function writeConfig(event: H3Event, key: string, value: unknown): Promise<void> {
  const db = useDb(event)
  const now = new Date()
  const storedValue = value === null ? sql`${JSON.stringify(value)}` : value
  await db.insert(storeSettings)
    .values({ key, value: storedValue, updatedAt: now })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: storedValue, updatedAt: now } })
}

export const marketingService = {
  async getConfig(event: H3Event) {
    const [meta, tiktok] = await Promise.all([
      readConfig<MetaAdsConfig>(event, META_CONFIG_KEY, { adAccountId: null }),
      readConfig<TiktokAdsConfig>(event, TIKTOK_CONFIG_KEY, { advertiserId: null }),
    ])
    return { metaAdAccountId: meta.adAccountId, tiktokAdvertiserId: tiktok.advertiserId }
  },

  async updateConfig(event: H3Event, input: { metaAdAccountId?: string | null, tiktokAdvertiserId?: string | null }) {
    if (input.metaAdAccountId !== undefined) {
      await writeConfig(event, META_CONFIG_KEY, { adAccountId: input.metaAdAccountId })
    }
    if (input.tiktokAdvertiserId !== undefined) {
      await writeConfig(event, TIKTOK_CONFIG_KEY, { advertiserId: input.tiktokAdvertiserId })
    }
    return this.getConfig(event)
  },

  /** Combined snapshot for the Marketing dashboard: store performance, analytics/pixel connection status, and ads-manager connection status. */
  async overview(event: H3Event) {
    const [storeOverview, settings, config] = await Promise.all([
      dashboardService.overview(event),
      settingsService.getBase(event),
      this.getConfig(event),
    ])

    const env = event.context.cloudflare?.env
    return {
      totalOrders: storeOverview.totalOrders,
      totalRevenue: storeOverview.totalRevenue,
      analytics: {
        gaConnected: !!settings.analytics.gaMeasurementId,
        fbPixelConnected: !!settings.analytics.fbPixelId,
        fbConversionsApiConnected: settings.analytics.fbConversionsApiEnabled && !!settings.analytics.fbPixelId && !!env?.FB_CONVERSIONS_ACCESS_TOKEN,
      },
      metaAds: { connected: !!(config.metaAdAccountId && env?.META_ADS_ACCESS_TOKEN) },
      tiktokAds: { connected: !!(config.tiktokAdvertiserId && env?.TIKTOK_ADS_ACCESS_TOKEN) },
    }
  },

  async metaAdsStatus(event: H3Event) {
    const config = await this.getConfig(event)
    const accessToken = event.context.cloudflare?.env?.META_ADS_ACCESS_TOKEN
    return { connected: !!(config.metaAdAccountId && accessToken), adAccountId: config.metaAdAccountId }
  },

  async metaAdsInsights(event: H3Event) {
    const status = await this.metaAdsStatus(event)
    if (!status.connected || !status.adAccountId) return { connected: false as const }
    const accessToken = event.context.cloudflare!.env!.META_ADS_ACCESS_TOKEN!
    const [insights, campaigns] = await Promise.all([
      fetchMetaAdsInsights({ adAccountId: status.adAccountId, accessToken }),
      fetchMetaAdsCampaigns({ adAccountId: status.adAccountId, accessToken }),
    ])
    return { connected: true as const, insights, campaigns }
  },

  async tiktokAdsStatus(event: H3Event) {
    const config = await this.getConfig(event)
    const accessToken = event.context.cloudflare?.env?.TIKTOK_ADS_ACCESS_TOKEN
    return { connected: !!(config.tiktokAdvertiserId && accessToken), advertiserId: config.tiktokAdvertiserId }
  },

  async tiktokAdsInsights(event: H3Event) {
    const status = await this.tiktokAdsStatus(event)
    if (!status.connected || !status.advertiserId) return { connected: false as const }
    const accessToken = event.context.cloudflare!.env!.TIKTOK_ADS_ACCESS_TOKEN!
    const [insights, campaigns] = await Promise.all([
      fetchTiktokAdsInsights({ advertiserId: status.advertiserId, accessToken }),
      fetchTiktokAdsCampaigns({ advertiserId: status.advertiserId, accessToken }),
    ])
    return { connected: true as const, insights, campaigns }
  },

  /** Generates a ready-to-post caption + hashtags for one product/platform/locale. Not persisted — the admin copies it into the real platform's post composer. */
  async generateSocialPost(event: H3Event, input: { productId: string, platform: 'instagram' | 'facebook' | 'tiktok', locale: 'fr' | 'en' | 'ar' }) {
    const [product, settings] = await Promise.all([
      productsService.get(event, input.productId),
      settingsService.getBase(event),
    ])

    const translation = input.locale !== 'fr' ? product.translations?.[input.locale] : null
    const name = translation?.name || product.name
    const shortDescription = translation?.shortDescription ?? product.shortDescription
    const description = translation?.description ?? product.description

    const { data, cost } = await generateSocialPost(event, {
      platform: input.platform,
      locale: input.locale,
      storeName: settings.storeName,
      productName: name,
      shortDescription,
      description,
      priceLabel: `${(product.basePrice / 100).toFixed(2)} DH`,
    })

    return {
      caption: data.caption,
      hashtags: data.hashtags,
      imageUrl: product.images[0]?.url ?? null,
      productName: name,
      cost,
    }
  },
}
