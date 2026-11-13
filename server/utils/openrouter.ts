import { createError, type H3Event } from 'h3'

/**
 * Thin OpenRouter client. Every AI feature in this app (catalog translation,
 * the AI product creation wizard) goes through here, so there's a single
 * place that knows about auth, model choice, and error handling for the
 * underlying provider.
 *
 * Text model: a cheap, capable multimodal model — used both for vision
 * (reading the reference photo) and pure text (translation). Image model:
 * a model that supports `input_references` for image-to-image generation,
 * which is what makes "same garment, new angle" carousel shots possible.
 */
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const TEXT_MODEL = 'google/gemini-2.5-flash'
const IMAGE_MODEL = 'google/gemini-2.5-flash-image'

function getApiKey(event: H3Event): string {
  const key = event.context.cloudflare?.env?.OPENROUTER_API_KEY
  if (!key) {
    throw createError({ statusCode: 500, statusMessage: 'OpenRouter is not configured (missing OPENROUTER_API_KEY)' })
  }
  return key
}

async function openRouterFetch(event: H3Event, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${OPENROUTER_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey(event)}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fashion-store.abarri-mohamed.workers.dev',
      'X-Title': 'Atelier Elegance Admin',
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const message = json?.error?.message || `OpenRouter request failed (${res.status})`
    throw createError({ statusCode: 502, statusMessage: message })
  }
  return json
}

function extractJson<T>(content: string): T {
  // Models occasionally wrap JSON in a ```json fence despite instructions not to.
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : content
  try {
    return JSON.parse(raw.trim()) as T
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: 'The AI returned a response that could not be parsed. Please try again.' })
  }
}

async function chatJson<T>(event: H3Event, params: { system: string, userText: string, imageDataUrl?: string }): Promise<{ data: T, cost: number }> {
  const userContent: any[] = [{ type: 'text', text: params.userText }]
  if (params.imageDataUrl) {
    userContent.push({ type: 'image_url', image_url: { url: params.imageDataUrl } })
  }

  const json = await openRouterFetch(event, '/chat/completions', {
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: userContent },
    ],
  })

  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw createError({ statusCode: 502, statusMessage: 'The AI returned an empty response. Please try again.' })
  }

  return { data: extractJson<T>(content), cost: Number(json?.usage?.cost ?? 0) }
}

export interface ProductCopyResult {
  name: string
  shortDescription: string
  description: string
  seoTitle: string
  seoDescription: string
}

/**
 * Analyzes the reference photo and writes French product copy (French is
 * this store's base/default locale — see the i18n system). Translation into
 * en/ar happens separately via `translateProductContent`.
 */
export async function generateProductCopyFromImage(event: H3Event, params: {
  imageDataUrl: string
  colors: string[]
  sizes: string[]
  priceLabel: string
  categoryName?: string
}): Promise<{ data: ProductCopyResult, cost: number }> {
  const system = [
    'You are a copywriter for "Atelier Elegance", an editorial-minimalist French fashion e-commerce brand.',
    'You will be shown a photo of a single clothing/fashion product. Write compelling, accurate product copy in FRENCH based only on what is visible in the photo plus the facts given.',
    'Never invent fabric/material claims you cannot see in the photo (e.g. do not claim "100% cashmere" unless visually obvious); describe fit, style, and visual texture instead.',
    'Respond with ONLY a JSON object, no markdown fences, with exactly these string fields: name, shortDescription, description, seoTitle, seoDescription.',
    '- name: concise, elegant product name, max 70 characters.',
    '- shortDescription: one enticing sentence, max 160 characters.',
    '- description: 2-3 short paragraphs (use \\n\\n between them), evocative but factual, mentioning the given colors and sizes naturally.',
    '- seoTitle: max 60 characters.',
    '- seoDescription: max 155 characters.',
  ].join('\n')

  const userText = [
    `Available colors: ${params.colors.join(', ') || 'not specified'}`,
    `Available sizes: ${params.sizes.join(', ') || 'not specified'}`,
    `Price: ${params.priceLabel}`,
    params.categoryName ? `Category: ${params.categoryName}` : null,
  ].filter(Boolean).join('\n')

  const { data, cost } = await chatJson<ProductCopyResult>(event, { system, userText, imageDataUrl: params.imageDataUrl })
  return { data, cost }
}

export interface TranslatedProductContent {
  name: string | null
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  landingBenefits: Array<{ icon?: string, text: string }> | null
  landingBlockCaptions: Array<string | null> | null
}

const LOCALE_NAMES: Record<'en' | 'ar', string> = { en: 'English', ar: 'Modern Standard Arabic' }

/** Translates a product's French copy into the given target locale. */
export async function translateProductContent(event: H3Event, params: {
  targetLocale: 'en' | 'ar'
  name: string
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  landingBenefits: Array<{ icon?: string, text: string }> | null
  landingBlocks: Array<{ imageUrl: string, caption?: string }> | null
}): Promise<{ data: TranslatedProductContent, cost: number }> {
  const system = [
    `You are a professional e-commerce translator. Translate the given French fashion product copy into ${LOCALE_NAMES[params.targetLocale]}.`,
    'Keep the tone elegant and editorial, matching the original. Do not add or remove information.',
    'Respond with ONLY a JSON object, no markdown fences, with exactly these fields:',
    'name (string), shortDescription (string or null), description (string or null), seoTitle (string or null), seoDescription (string or null),',
    'landingBenefits (array of {icon, text} or null, same length/order as input, icon unchanged), landingBlockCaptions (array of strings or null, same length/order as the input captions list).',
    'If an input field is null, its output must be null.',
  ].join('\n')

  const userText = JSON.stringify({
    name: params.name,
    shortDescription: params.shortDescription,
    description: params.description,
    seoTitle: params.seoTitle,
    seoDescription: params.seoDescription,
    landingBenefits: params.landingBenefits,
    landingBlockCaptions: params.landingBlocks?.map(b => b.caption ?? null) ?? null,
  })

  const { data, cost } = await chatJson<TranslatedProductContent>(event, { system, userText })
  return { data, cost }
}

export interface TranslatedCategoryContent {
  name: string
  description: string | null
}

export async function translateCategoryContent(event: H3Event, params: {
  targetLocale: 'en' | 'ar'
  name: string
  description: string | null
}): Promise<{ data: TranslatedCategoryContent, cost: number }> {
  const system = [
    `Translate the given French e-commerce category name/description into ${LOCALE_NAMES[params.targetLocale]}.`,
    'Respond with ONLY a JSON object, no markdown fences: { "name": string, "description": string|null }.',
  ].join('\n')

  const userText = JSON.stringify({ name: params.name, description: params.description })
  const { data, cost } = await chatJson<TranslatedCategoryContent>(event, { system, userText })
  return { data, cost }
}

export interface GeneratedImage {
  dataUrl: string
  mediaType: string
}

/**
 * Generates one new product photo consistent with the given reference photo
 * (same garment, different angle/setting per `prompt`). The underlying model
 * only returns one image per call (n is capped at 1), so the wizard calls
 * this once per desired carousel shot.
 */
export async function generateProductImage(event: H3Event, params: {
  referenceImageDataUrl: string
  prompt: string
  aspectRatio?: string
}): Promise<{ data: GeneratedImage, cost: number }> {
  const json = await openRouterFetch(event, '/images', {
    model: IMAGE_MODEL,
    prompt: params.prompt,
    n: 1,
    aspect_ratio: params.aspectRatio ?? '3:4',
    input_references: [
      { type: 'image_url', image_url: { url: params.referenceImageDataUrl } },
    ],
  })

  const entry = json?.data?.[0]
  if (!entry?.b64_json) {
    throw createError({ statusCode: 502, statusMessage: 'The AI did not return an image. Please try again.' })
  }

  const mediaType = entry.media_type || 'image/png'
  return {
    data: { dataUrl: `data:${mediaType};base64,${entry.b64_json}`, mediaType },
    cost: Number(json?.usage?.cost ?? 0),
  }
}

/** Writes French SEO meta title/description for an existing product from its name + description (no image needed). */
export async function generateProductSeo(event: H3Event, params: {
  name: string
  description: string | null
}): Promise<{ data: { seoTitle: string, seoDescription: string }, cost: number }> {
  const system = [
    'Write an SEO meta title and meta description in FRENCH for this fashion e-commerce product, based on its name and description.',
    'Respond with ONLY a JSON object, no markdown fences: { "seoTitle": string, "seoDescription": string }.',
    '- seoTitle: max 60 characters, naturally includes the product name.',
    '- seoDescription: max 155 characters, enticing and accurate — no invented claims.',
  ].join('\n')
  const userText = JSON.stringify({ name: params.name, description: params.description })
  const { data, cost } = await chatJson<{ seoTitle: string, seoDescription: string }>(event, { system, userText })
  return { data, cost }
}

export interface HomepageCopyResult {
  tagline: string
  announcementBar: string
  hero: { title: string, subtitle: string, ctaLabel: string }
  promo: { title: string, subtitle: string }
  trustBadges: Array<{ icon?: string, label: string }>
}

/** Writes fresh French homepage marketing copy (hero, tagline, promo banner, trust badges) reflecting the actual store. */
export async function generateHomepageCopy(event: H3Event, params: {
  storeName: string
  categoryNames: string[]
}): Promise<{ data: HomepageCopyResult, cost: number }> {
  const system = [
    `You are a copywriter for "${params.storeName}", an editorial-minimalist French fashion e-commerce brand selling cash-on-delivery clothing in Morocco.`,
    'Write homepage marketing copy in FRENCH, elegant, concise, and specific to the brand — never generic filler.',
    'Respond with ONLY a JSON object, no markdown fences, with exactly this shape:',
    '{ "tagline": string, "announcementBar": string, "hero": { "title": string, "subtitle": string, "ctaLabel": string }, "promo": { "title": string, "subtitle": string }, "trustBadges": [{ "icon": string, "label": string }, ...] }',
    '- tagline: one short brand line, max 80 characters.',
    '- announcementBar: a short promotional line for a thin bar shown above the header on every page, max 80 characters.',
    '- hero.title: a striking homepage headline, max 60 characters.',
    '- hero.subtitle: one supporting sentence, max 140 characters.',
    '- hero.ctaLabel: a short call-to-action button label, max 24 characters.',
    '- promo.title: a short line emphasizing cash-on-delivery, max 60 characters.',
    '- promo.subtitle: one supporting sentence, max 120 characters.',
    '- trustBadges: exactly 3 items covering cash-on-delivery, nationwide shipping, and the exchange policy, in that order. Each "icon" is a single unicode symbol character (no emoji), each "label" is max 40 characters.',
  ].join('\n')

  const userText = params.categoryNames.length ? `Product categories: ${params.categoryNames.join(', ')}` : 'No categories yet.'

  const { data, cost } = await chatJson<HomepageCopyResult>(event, { system, userText })
  return { data, cost }
}

export interface SettingsTranslationResult {
  tagline: string | null
  announcementBar: string | null
  hero: { title: string | null, subtitle: string | null, ctaLabel: string | null } | null
  promo: { title: string | null, subtitle: string | null } | null
  trustBadges: Array<{ label: string | null }> | null
}

/** Translates the store's homepage copy (hero, tagline, promo, trust badge labels) into the given target locale. */
export async function translateSettingsContent(event: H3Event, params: {
  targetLocale: 'en' | 'ar'
  tagline: string
  announcementBar: string | null
  hero: { title: string, subtitle: string, ctaLabel: string }
  promo: { title: string, subtitle: string }
  trustBadges: Array<{ icon?: string, label: string }>
}): Promise<{ data: SettingsTranslationResult, cost: number }> {
  const system = [
    `Translate this French e-commerce homepage copy into ${LOCALE_NAMES[params.targetLocale]}. Keep the tone elegant and concise, matching the original.`,
    'Respond with ONLY a JSON object, no markdown fences, with exactly this shape:',
    '{ "tagline": string, "announcementBar": string|null, "hero": {"title":string,"subtitle":string,"ctaLabel":string}, "promo": {"title":string,"subtitle":string}, "trustBadges": [{"label":string}, ...] }',
    'trustBadges must have the same length and order as the input (icons are not translated, omit them).',
  ].join('\n')

  const userText = JSON.stringify({
    tagline: params.tagline,
    announcementBar: params.announcementBar,
    hero: params.hero,
    promo: params.promo,
    trustBadges: params.trustBadges.map(b => ({ label: b.label })),
  })

  const { data, cost } = await chatJson<SettingsTranslationResult>(event, { system, userText })
  return { data, cost }
}
