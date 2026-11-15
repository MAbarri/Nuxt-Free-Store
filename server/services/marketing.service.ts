import { eq, sql } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { useDb } from '../utils/db'
import { storeSettings } from '../database/schema'
import { settingsService } from './settings.service'
import { dashboardService } from './dashboard.service'
import { productsService } from './products.service'
import { generateSocialPost, generateSocialPostImage, generateAdCreativeCopy, generateAdCreativeImage } from '../utils/openrouter'
import { getLogoDataUrlForWatermark } from './ai.service'
import { readImageFromR2AsDataUrl, uploadImageToR2, dataUrlToBytes } from '../utils/media'
import { fetchMetaAdsInsights, fetchMetaAdsCampaigns } from '../utils/metaMarketingApi'
import { fetchTiktokAdsInsights, fetchTiktokAdsCampaigns } from '../utils/tiktokMarketingApi'
import { socialPostsRepository } from '../repositories/socialPosts.repository'
import { adCreativesRepository } from '../repositories/adCreatives.repository'

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

/** Builds the prompt for the AI-generated post image — reuses the same post-angle instruction as the caption so the photo's mood matches what the caption is saying, plus whatever specific direction the admin typed in the "image instructions" field. Asks for an actual designed social-media graphic with the caption's headline (and optional badge) rendered directly on the photo — not a bare, text-free product photo (see SOCIAL_IMAGE_PLATFORM_STYLE). */
function buildSocialImagePrompt(params: { platform: 'instagram' | 'facebook' | 'tiktok', promptInstruction: string, headline: string, overlayText?: string | null, imageInstructions?: string | null }): string {
  return [
    'Create an actual designed social media graphic (not a bare, text-free product photo), featuring the exact garment(s) shown in the reference image(s) — keep their color, pattern, fabric and design identical to the references, never a different garment.',
    SOCIAL_IMAGE_PLATFORM_STYLE[params.platform],
    `Visual mood to match this post's angle: ${params.promptInstruction}`,
    `Render this exact headline text prominently on the image, in bold, legible, on-brand typography that fits the composition (do not alter, translate, or paraphrase it, and do not add quote marks around it): ${params.headline}`,
    params.overlayText ? `Also render this exact short badge/label text somewhere in the design (e.g. a colored badge, ribbon, or corner banner), unaltered: ${params.overlayText}` : null,
    params.imageInstructions ? `Additional specific direction from the admin, follow it closely: ${params.imageInstructions}` : null,
    'The headline (and badge, if present) must be fully legible, correctly spelled, and well-integrated into the composition with good contrast against its backdrop — this must read as a finished, professionally designed piece of content, not a plain catalog photo with no text.',
  ].filter(Boolean).join(' ')
}

// A selectable library of ad "design types", grouped by category, for the
// design picker in Marketing → Ads content generator. Same idea as
// SOCIAL_POST_PROMPT_TYPES, but each type carries two separate directions:
// `copyInstruction` (how the ad copy should read) and `designInstruction`
// (how the ad image itself should be visually composed) — ad creatives are
// judged much more on their visual design than a social caption is.
export interface AdDesignType {
  id: string
  label: string
  category: 'product-showcase' | 'promotional' | 'urgency' | 'social-proof' | 'seasonal' | 'brand'
  categoryLabel: string
  copyInstruction: string
  designInstruction: string
}

export const AD_DESIGN_TYPES: AdDesignType[] = [
  {
    id: 'clean-studio-ad',
    label: 'Clean studio hero ad',
    category: 'product-showcase',
    categoryLabel: 'Product showcase',
    copyInstruction: 'A clean, confident hero shot angle — let the product itself be the headline act, with simple, benefit-focused copy.',
    designInstruction: 'Center the product as the clear hero against a clean, minimal, color-coordinated backdrop, with the headline placed in generous negative space (top or side) in bold modern typography — a premium catalog-meets-ad composition.',
  },
  {
    id: 'lifestyle-scene-ad',
    label: 'Lifestyle scene ad',
    category: 'product-showcase',
    categoryLabel: 'Product showcase',
    copyInstruction: 'Evoke the lifestyle/occasion this piece is worn for, as if selling a feeling as much as a product.',
    designInstruction: 'Show the product worn/used in a realistic, tasteful lifestyle setting matching the brand, with the headline integrated into open space in the scene (not overlapping the garment) using clean, legible typography.',
  },
  {
    id: 'flat-lay-ad',
    label: 'Styled flat-lay ad',
    category: 'product-showcase',
    categoryLabel: 'Product showcase',
    copyInstruction: 'Highlight the product\'s details and styling versatility, as part of a curated flat-lay look.',
    designInstruction: 'Compose a styled flat-lay (product plus a few complementary props on a textured surface, shot from above or a flattering angle), with the headline set in a clean banner across the top or bottom third.',
  },
  {
    id: 'discount-banner-ad',
    label: 'Discount banner ad',
    category: 'promotional',
    categoryLabel: 'Promotional',
    copyInstruction: 'Frame this as a discount/sale ad. Only mention a specific percentage or amount if one is given in the extra details — otherwise keep it generic ("Now on sale") rather than inventing numbers.',
    designInstruction: 'Feature the product prominently with a bold, high-contrast colored banner or badge carrying the discount headline/badge text, styled like a real promotional ad creative (strong color blocking, confident typography).',
  },
  {
    id: 'flash-sale-ad',
    label: 'Flash sale countdown ad',
    category: 'promotional',
    categoryLabel: 'Promotional',
    copyInstruction: 'Create urgency as a flash/limited-time sale — short, punchy, time-pressure language — without inventing a specific deadline unless one is given in the extra details.',
    designInstruction: 'High-energy, high-contrast "flash sale" design treatment — bold diagonal or stamp-style badge for the headline, urgent color palette (e.g. reds/oranges or the brand\'s accent color pushed bold), dynamic composition.',
  },
  {
    id: 'bundle-offer-ad',
    label: 'Bundle / quantity discount ad',
    category: 'promotional',
    categoryLabel: 'Promotional',
    copyInstruction: 'Promote a buy-more-save style offer (e.g. "buy 2, save") if quantity-discount details are given in the extra details — otherwise keep it generic about styling a full look together.',
    designInstruction: 'Show the product with a clean banner-style badge carrying the bundle/offer headline, laid out like a straightforward value-focused promotional ad.',
  },
  {
    id: 'free-delivery-cod-ad',
    label: 'Free delivery & Cash on Delivery ad',
    category: 'promotional',
    categoryLabel: 'Promotional',
    copyInstruction: 'Emphasize cash-on-delivery and nationwide delivery as the main trust-building hook — a key reason Moroccan shoppers buy online with confidence.',
    designInstruction: 'Feature the product with a confident trust-badge element (e.g. a seal/ribbon-style graphic) carrying the delivery/COD headline, clean and reassuring rather than loud.',
  },
  {
    id: 'limited-stock-ad',
    label: 'Limited stock ad',
    category: 'urgency',
    categoryLabel: 'Urgency & scarcity',
    copyInstruction: 'Emphasize that stock is limited and it could sell out, encouraging the viewer to order soon, without inventing an exact remaining quantity.',
    designInstruction: 'Add a bold "limited stock" ribbon or corner badge to an otherwise clean product shot, with the headline set in confident, slightly urgent typography.',
  },
  {
    id: 'last-chance-ad',
    label: 'Last chance ad',
    category: 'urgency',
    categoryLabel: 'Urgency & scarcity',
    copyInstruction: 'Frame this as a last-chance/final-call message, without inventing a specific deadline unless one is given in the extra details.',
    designInstruction: 'Bold, large "last chance"-style headline typography dominating part of the composition, high contrast against the product photo, confident and direct.',
  },
  {
    id: 'bestseller-ad',
    label: 'Bestseller / customer favorite ad',
    category: 'social-proof',
    categoryLabel: 'Social proof',
    copyInstruction: 'Present this as a bestseller or customer favorite, building trust through popularity rather than inventing specific review quotes or numbers.',
    designInstruction: 'Add a tasteful "bestseller"/"customer favorite" ribbon or badge to a clean, premium product shot — never invented star ratings or review counts anywhere in the design.',
  },
  {
    id: 'trusted-ad',
    label: 'Trusted by customers ad',
    category: 'social-proof',
    categoryLabel: 'Social proof',
    copyInstruction: 'Build general trust and credibility around the brand/product, without inventing specific testimonials, ratings, or customer counts.',
    designInstruction: 'A clean, reassuring seal/stamp-style badge element paired with the product, understated and premium rather than loud — no invented star ratings or quotes anywhere in the design.',
  },
  {
    id: 'seasonal-collection-ad',
    label: 'Seasonal collection ad',
    category: 'seasonal',
    categoryLabel: 'Seasonal',
    copyInstruction: 'Position this piece as part of the current season\'s collection, evoking that season\'s mood (weather, activities, colors) without naming a specific holiday.',
    designInstruction: 'A color palette and backdrop evoking the current season, with the headline set in typography matching that seasonal mood.',
  },
  {
    id: 'occasion-ad',
    label: 'Holiday / occasion ad',
    category: 'seasonal',
    categoryLabel: 'Seasonal',
    copyInstruction: 'Tie this post to a seasonal holiday or occasion (use whatever occasion is named in the extra details; otherwise keep it general-seasonal without naming a specific holiday).',
    designInstruction: 'Festive, occasion-appropriate design accents (color palette, subtle motifs) around the product, with the headline styled to match that occasion\'s mood.',
  },
  {
    id: 'brand-story-ad',
    label: 'Brand story / quality ad',
    category: 'brand',
    categoryLabel: 'Brand & value',
    copyInstruction: 'Connect this piece to the brand\'s craftsmanship/quality story, using the product as an example of that philosophy rather than a hard sell.',
    designInstruction: 'An elegant, editorial design treatment — generous negative space, refined serif or minimal typography for the headline, like a premium brand campaign rather than a discount ad.',
  },
  {
    id: 'why-choose-us-ad',
    label: 'Why choose us ad',
    category: 'brand',
    categoryLabel: 'Brand & value',
    copyInstruction: 'Highlight concrete reasons to buy from this store specifically (cash-on-delivery, nationwide delivery, easy exchanges), using only what\'s actually offered rather than invented claims.',
    designInstruction: 'A clean, confident layout pairing the product with a short list of trust points as simple iconographic badges, premium and uncluttered.',
  },
]

function getAdDesignType(id: string): AdDesignType {
  const type = AD_DESIGN_TYPES.find(t => t.id === id)
  if (!type) throw createError({ statusCode: 422, statusMessage: `Unknown ad design type: ${id}` })
  return type
}

// Ad platforms deliberately mirror the two ad accounts this app can already
// connect to (Meta ads manager / TikTok ads manager) rather than the social
// post generator's three — "generic" use outside those two isn't the point
// of this feature, the ad-copy fields are tailored to real ad-composer UIs.
const AD_IMAGE_ASPECT_RATIO: Record<'meta' | 'tiktok', string> = {
  meta: '4:5',
  tiktok: '9:16',
}

const AD_IMAGE_PLATFORM_STYLE: Record<'meta' | 'tiktok', string> = {
  meta: 'Designed as a scroll-stopping Meta (Facebook/Instagram) feed ad: professional ad-agency quality layout, bold and highly legible headline typography with strong contrast against its backdrop, a balanced composition that leaves clear, deliberate space for the headline/badge text, cohesive premium color grading.',
  tiktok: 'Designed as a bold, vibrant TikTok ad creative: full-bleed vertical composition, punchy high-contrast headline typography sized for mobile thumb-scroll attention, dynamic but balanced energy.',
}

/** Builds the prompt for the AI-generated ad image — combines the selected design type's visual brief with the platform's native ad style, and bakes the exact headline/badge text (from generateAdCreativeCopy) directly into the design. */
function buildAdImagePrompt(params: { platform: 'meta' | 'tiktok', designInstruction: string, headline: string, badgeText?: string | null, imageInstructions?: string | null }): string {
  return [
    'Create a professionally designed advertising creative (not a plain product photo), featuring the exact garment(s) shown in the reference image(s) — keep their color, pattern, fabric and design identical to the references, never a different garment.',
    AD_IMAGE_PLATFORM_STYLE[params.platform],
    `Design brief for this ad type: ${params.designInstruction}`,
    `Render this exact headline text prominently on the image, in bold, legible, on-brand typography (do not alter, translate, or paraphrase it, and do not add quote marks around it): ${params.headline}`,
    params.badgeText ? `Also render this exact short badge/label text somewhere in the design (e.g. a colored badge, ribbon, or corner banner), unaltered: ${params.badgeText}` : null,
    params.imageInstructions ? `Additional specific direction from the admin, follow it closely: ${params.imageInstructions}` : null,
    'The headline (and badge, if present) must be fully legible, correctly spelled, and well-integrated into the composition with good contrast against its backdrop — this must be a finished ad design, not a bare photo with no text.',
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
        gtmConnected: !!settings.analytics.gtmContainerId,
        clarityConnected: !!settings.analytics.clarityProjectId,
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
      headline: data.headline,
      overlayText: data.overlayText,
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
      headline: data.headline,
      overlayText: data.overlayText,
      cost,
    })

    return {
      id,
      caption: data.caption,
      hashtags: data.hashtags,
      headline: data.headline,
      overlayText: data.overlayText,
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

  /** Generates Meta/TikTok-style ad copy (headline, primary text, description, CTA) AND a matching AI-generated ad creative image (from up to 3 admin-chosen reference images) for one product/platform/locale/design-type, and saves it to the ad-creative history (see listSavedAdCreatives/deleteSavedAdCreative). */
  async generateAdCreative(event: H3Event, input: { productId: string, platform: 'meta' | 'tiktok', locale: 'fr' | 'en' | 'ar', designTypeId: string, extraNotes?: string | null, referenceImageUrls: string[], imageInstructions?: string | null }) {
    const designType = getAdDesignType(input.designTypeId)
    const [product, settings] = await Promise.all([
      productsService.get(event, input.productId),
      settingsService.getBase(event),
    ])

    const translation = input.locale !== 'fr' ? product.translations?.[input.locale] : null
    const name = translation?.name || product.name
    const shortDescription = translation?.shortDescription ?? product.shortDescription
    const description = translation?.description ?? product.description

    const { data, cost: copyCost } = await generateAdCreativeCopy(event, {
      platform: input.platform,
      locale: input.locale,
      storeName: settings.storeName,
      productName: name,
      shortDescription,
      description,
      priceLabel: `${(product.basePrice / 100).toFixed(2)} DH`,
      copyInstruction: designType.copyInstruction,
      extraNotes: input.extraNotes,
    })
    let cost = copyCost

    const referenceImageDataUrls = (await Promise.all(
      input.referenceImageUrls.map(url => readImageFromR2AsDataUrl(event, url)),
    )).filter((url): url is string => !!url)
    if (!referenceImageDataUrls.length) {
      throw createError({ statusCode: 422, statusMessage: 'The selected input images could not be read. Please pick different images.' })
    }

    const logoDataUrl = await getLogoDataUrlForWatermark(event)
    const imagePrompt = buildAdImagePrompt({
      platform: input.platform,
      designInstruction: designType.designInstruction,
      headline: data.headline,
      badgeText: data.badgeText,
      imageInstructions: input.imageInstructions,
    })
    const { data: image, cost: imageCost } = await generateAdCreativeImage(event, {
      referenceImageDataUrls,
      prompt: imagePrompt,
      aspectRatio: AD_IMAGE_ASPECT_RATIO[input.platform],
      logoDataUrl,
    })
    cost += imageCost

    const { data: imageBytes, contentType } = dataUrlToBytes(image.dataUrl)
    const { url: imageUrl } = await uploadImageToR2(event, { data: imageBytes, contentType, folder: `marketing/ad-creatives/${product.id}` })

    const id = await adCreativesRepository.create(event, {
      productId: product.id,
      productName: name,
      imageUrl,
      platform: input.platform,
      locale: input.locale,
      designTypeId: designType.id,
      designTypeLabel: designType.label,
      extraNotes: input.extraNotes ?? null,
      imageInstructions: input.imageInstructions ?? null,
      headline: data.headline,
      primaryText: data.primaryText,
      description: data.description || null,
      ctaLabel: data.ctaLabel,
      badgeText: data.badgeText,
      cost,
    })

    return {
      id,
      headline: data.headline,
      primaryText: data.primaryText,
      description: data.description || null,
      ctaLabel: data.ctaLabel,
      badgeText: data.badgeText,
      imageUrl,
      productName: name,
      cost,
    }
  },

  /** Saved history of generated ad creatives, newest first — see server/repositories/adCreatives.repository.ts. */
  async listSavedAdCreatives(event: H3Event) {
    return adCreativesRepository.list(event)
  },

  async deleteSavedAdCreative(event: H3Event, id: string) {
    await adCreativesRepository.remove(event, id)
  },
}
