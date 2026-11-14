import { eq, sql } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { useDb } from '../utils/db'
import { storeSettings } from '../database/schema'
import { settingsService } from './settings.service'
import { dashboardService } from './dashboard.service'
import { productsService } from './products.service'
import { generateSocialPost, generateSocialPostImage } from '../utils/openrouter'
import { getLogoDataUrlForWatermark } from './ai.service'
import { readImageFromR2AsDataUrl, uploadImageToR2, dataUrlToBytes } from '../utils/media'
import { fetchMetaAdsInsights, fetchMetaAdsCampaigns } from '../utils/metaMarketingApi'
import { fetchTiktokAdsInsights, fetchTiktokAdsCampaigns } from '../utils/tiktokMarketingApi'
import { socialPostsRepository } from '../repositories/socialPosts.repository'

export interface SocialPostPromptType {
  id: string
  label: string
  category: 'promotional' | 'product-highlight' | 'engagement' | 'seasonal' | 'social-proof' | 'brand-story'
  categoryLabel: string
  /** Style directive appended to the AI's system prompt — see openrouter.ts's generateSocialPost. */
  instruction: string
}

// A selectable library of post "angles", grouped by category, for the prompt
// picker in Marketing → Social post generator (same idea as ai.service.ts's
// IMAGE_SCENES, but for caption style/angle rather than photo framing).
export const SOCIAL_POST_PROMPT_TYPES: SocialPostPromptType[] = [
  {
    id: 'new-arrival',
    label: 'New arrival announcement',
    category: 'promotional',
    categoryLabel: 'Promotional',
    instruction: 'Introduce this as a fresh new-arrival, building excitement about it just landing in the store.',
  },
  {
    id: 'discount-sale',
    label: 'Discount / sale announcement',
    category: 'promotional',
    categoryLabel: 'Promotional',
    instruction: 'Frame this as a discount or sale announcement. Only mention a specific percentage, amount, or end date if one is given in the extra details — otherwise keep the offer generic ("now on sale") rather than inventing numbers.',
  },
  {
    id: 'flash-sale',
    label: 'Flash sale / urgency',
    category: 'promotional',
    categoryLabel: 'Promotional',
    instruction: 'Create urgency as a flash/limited-time sale — short, punchy, time-pressure language — without inventing a specific deadline unless one is given in the extra details.',
  },
  {
    id: 'limited-stock',
    label: 'Limited stock',
    category: 'promotional',
    categoryLabel: 'Promotional',
    instruction: 'Emphasize that stock is limited and it could sell out, encouraging the reader to order soon, without inventing an exact remaining quantity.',
  },
  {
    id: 'styling-tip',
    label: 'Styling tip / how to wear it',
    category: 'product-highlight',
    categoryLabel: 'Product highlight',
    instruction: 'Give a concrete styling tip — how to wear or pair this piece for a specific occasion or look — rather than a generic product pitch.',
  },
  {
    id: 'outfit-pairing',
    label: 'Outfit pairing idea',
    category: 'product-highlight',
    categoryLabel: 'Product highlight',
    instruction: 'Suggest a full outfit built around this piece (what to pair it with), evoking a complete look rather than describing the item alone.',
  },
  {
    id: 'fabric-quality',
    label: 'Fabric / quality spotlight',
    category: 'product-highlight',
    categoryLabel: 'Product highlight',
    instruction: 'Focus on the craftsmanship, fabric feel, and quality of this piece — what makes it well-made — based only on what is actually stated in the product info.',
  },
  {
    id: 'poll-question',
    label: 'Question / poll for followers',
    category: 'engagement',
    categoryLabel: 'Engagement',
    instruction: 'End with a genuine question inviting followers to comment or reply (e.g. how they would style it, which color they prefer), to drive engagement rather than just announcing the product.',
  },
  {
    id: 'this-or-that',
    label: '"This or that" comparison',
    category: 'engagement',
    categoryLabel: 'Engagement',
    instruction: 'Frame this as a playful "this or that" style comparison post (e.g. dressed up vs. dressed down with this piece), inviting followers to pick a side in the comments.',
  },
  {
    id: 'seasonal-occasion',
    label: 'Holiday / occasion greeting',
    category: 'seasonal',
    categoryLabel: 'Seasonal',
    instruction: 'Tie this post to a seasonal holiday or occasion (use whatever occasion is named in the extra details; otherwise keep it general-seasonal without naming a specific holiday).',
  },
  {
    id: 'seasonal-collection',
    label: 'Seasonal collection push',
    category: 'seasonal',
    categoryLabel: 'Seasonal',
    instruction: 'Position this piece as part of the current season\'s collection, evoking that season\'s mood (weather, activities, colors) without naming a specific holiday.',
  },
  {
    id: 'bestseller',
    label: 'Bestseller / customer favorite',
    category: 'social-proof',
    categoryLabel: 'Social proof',
    instruction: 'Present this as a bestseller or customer favorite, building trust through popularity rather than inventing specific review quotes or numbers.',
  },
  {
    id: 'behind-the-scenes',
    label: 'Behind-the-scenes / craftsmanship',
    category: 'brand-story',
    categoryLabel: 'Brand story',
    instruction: 'Write this as a behind-the-scenes style post about how this kind of piece is made or chosen, giving a glimpse into the brand\'s care and process rather than a direct sales pitch.',
  },
  {
    id: 'brand-values',
    label: 'Brand values / mission',
    category: 'brand-story',
    categoryLabel: 'Brand story',
    instruction: 'Connect this piece to the brand\'s broader values or mission (quality, timelessness, thoughtful design), using the product as an example of that philosophy rather than a hard sell.',
  },
]

function getSocialPostPromptType(id: string): SocialPostPromptType {
  const type = SOCIAL_POST_PROMPT_TYPES.find(t => t.id === id)
  if (!type) throw createError({ statusCode: 422, statusMessage: `Unknown post type: ${id}` })
  return type
}

// Each platform's native feed format — drives the generated image's shape.
const SOCIAL_IMAGE_ASPECT_RATIO: Record<'instagram' | 'facebook' | 'tiktok', string> = {
  instagram: '1:1',
  facebook: '1:1',
  tiktok: '9:16',
}

const SOCIAL_IMAGE_PLATFORM_STYLE: Record<'instagram' | 'facebook' | 'tiktok', string> = {
  instagram: 'Styled like a top fashion brand\'s Instagram feed post, art-directed by a professional social media designer: a considered, color-coordinated backdrop or props (not a flat plain studio wall), soft flattering natural or golden-hour light, a well-balanced, slightly asymmetric composition with intentional negative space, a cohesive premium color grade — the kind of image that looks curated, not a generic product listing photo.',
  facebook: 'Clean, warm, inviting photo art-directed for a Facebook feed post: a considered, color-coordinated backdrop or setting, soft natural light, balanced composition — polished and premium rather than a plain catalog photo.',
  tiktok: 'Bold, vibrant, trend-forward vertical photo art-directed for a TikTok post cover: an eye-catching, color-coordinated setting with good depth and energy, strong natural or golden-hour light, dynamic but balanced composition — polished and premium rather than a plain catalog photo.',
}

/** Builds the prompt for the AI-generated post image — reuses the same post-angle instruction as the caption so the photo's mood matches what the caption is saying, plus whatever specific direction the admin typed in the "image instructions" field. Deliberately pushes for an art-directed, "designer made" social-content look rather than a plain product-catalog photo (see SOCIAL_IMAGE_PLATFORM_STYLE). */
function buildSocialImagePrompt(params: { platform: 'instagram' | 'facebook' | 'tiktok', promptInstruction: string, imageInstructions?: string | null }): string {
  return [
    'Scroll-stopping, designer-made social media content photo, featuring the exact garment(s) shown in the reference image(s) — keep their color, pattern, fabric and design identical to the references, never a different garment.',
    SOCIAL_IMAGE_PLATFORM_STYLE[params.platform],
    `Visual mood to match this post's angle: ${params.promptInstruction}`,
    params.imageInstructions ? `Additional specific direction from the admin, follow it closely: ${params.imageInstructions}` : null,
    'No added text or captions baked into the photo.',
  ].filter(Boolean).join(' ')
}

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

  /** Generates a ready-to-post caption + hashtags AND a matching AI-generated photo (from up to 3 admin-chosen reference images) for one product/platform/locale/prompt-type, and saves it to the post history (see listSavedPosts/deleteSavedPost) so it can be revisited or cleaned up later. */
  async generateSocialPost(event: H3Event, input: { productId: string, platform: 'instagram' | 'facebook' | 'tiktok', locale: 'fr' | 'en' | 'ar', promptTypeId: string, extraNotes?: string | null, referenceImageUrls: string[], imageInstructions?: string | null }) {
    const promptType = getSocialPostPromptType(input.promptTypeId)
    const [product, settings] = await Promise.all([
      productsService.get(event, input.productId),
      settingsService.getBase(event),
    ])

    const translation = input.locale !== 'fr' ? product.translations?.[input.locale] : null
    const name = translation?.name || product.name
    const shortDescription = translation?.shortDescription ?? product.shortDescription
    const description = translation?.description ?? product.description

    const { data, cost: captionCost } = await generateSocialPost(event, {
      platform: input.platform,
      locale: input.locale,
      storeName: settings.storeName,
      productName: name,
      shortDescription,
      description,
      priceLabel: `${(product.basePrice / 100).toFixed(2)} DH`,
      promptInstruction: promptType.instruction,
      extraNotes: input.extraNotes,
    })
    let cost = captionCost

    const referenceImageDataUrls = (await Promise.all(
      input.referenceImageUrls.map(url => readImageFromR2AsDataUrl(event, url)),
    )).filter((url): url is string => !!url)
    if (!referenceImageDataUrls.length) {
      throw createError({ statusCode: 422, statusMessage: 'The selected input images could not be read. Please pick different images.' })
    }

    const logoDataUrl = await getLogoDataUrlForWatermark(event)
    const imagePrompt = buildSocialImagePrompt({
      platform: input.platform,
      promptInstruction: promptType.instruction,
      imageInstructions: input.imageInstructions,
    })
    const { data: image, cost: imageCost } = await generateSocialPostImage(event, {
      referenceImageDataUrls,
      prompt: imagePrompt,
      aspectRatio: SOCIAL_IMAGE_ASPECT_RATIO[input.platform],
      logoDataUrl,
    })
    cost += imageCost

    const { data: imageBytes, contentType } = dataUrlToBytes(image.dataUrl)
    const { url: imageUrl } = await uploadImageToR2(event, { data: imageBytes, contentType, folder: `marketing/social-posts/${product.id}` })

    const id = await socialPostsRepository.create(event, {
      productId: product.id,
      productName: name,
      imageUrl,
      platform: input.platform,
      locale: input.locale,
      promptTypeId: promptType.id,
      promptTypeLabel: promptType.label,
      extraNotes: input.extraNotes ?? null,
      imageInstructions: input.imageInstructions ?? null,
      caption: data.caption,
      hashtags: data.hashtags,
      cost,
    })

    return {
      id,
      caption: data.caption,
      hashtags: data.hashtags,
      imageUrl,
      productName: name,
      cost,
    }
  },

  /** Saved history of generated posts, newest first — see server/repositories/socialPosts.repository.ts. */
  async listSavedPosts(event: H3Event) {
    return socialPostsRepository.list(event)
  },

  async deleteSavedPost(event: H3Event, id: string) {
    await socialPostsRepository.remove(event, id)
  },
}
