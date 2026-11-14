import { createError } from 'h3'

/**
 * Fetches OpenRouter's public model catalog (no API key required for this
 * endpoint) and curates it down to what's actually safe to offer in the
 * Settings → AI models picker:
 *  - "text" candidates: multimodal chat models (accept image input, since
 *    the product-copy-from-photo wizard step needs that on whatever model
 *    is chosen) that also return text.
 *  - "image" candidates: models that return image output, for image-to-image
 *    generation (product photos / lifestyle blocks).
 * Pricing is surfaced so an admin can see the cost impact of switching.
 */
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

export interface ModelOption {
  id: string
  name: string
  /** Short human-readable price-per-use hint, e.g. "$0.30 / $2.50 per 1M tokens". */
  priceLabel: string
}

interface RawModel {
  id: string
  name: string
  architecture?: { input_modalities?: string[], output_modalities?: string[] }
  pricing?: { prompt?: string, completion?: string, image_output?: string }
}

function formatPerMillion(value: string | undefined): string | null {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return null
  return `$${(num * 1_000_000).toFixed(2)} / 1M`
}

/** Formats a small per-unit dollar price (e.g. $0.00003/image) without losing precision to rounding — picks just enough decimals to show at least 2 significant digits. */
function formatSmallPrice(value: number): string {
  if (value >= 0.01) return `$${value.toFixed(3)}`
  const decimals = Math.max(2, -Math.floor(Math.log10(value)) + 1)
  return `$${value.toFixed(decimals)}`
}

function priceLabelFor(model: RawModel, kind: 'text' | 'image'): string {
  const prompt = formatPerMillion(model.pricing?.prompt)
  const completion = formatPerMillion(model.pricing?.completion)
  const parts = [prompt && `in ${prompt} tok`, completion && `out ${completion} tok`]
  if (kind === 'image') {
    const imageOutput = Number(model.pricing?.image_output)
    if (Number.isFinite(imageOutput) && imageOutput > 0) parts.push(`${formatSmallPrice(imageOutput)} / image unit`)
  }
  return parts.filter(Boolean).join(' · ') || 'Pricing unavailable'
}

export async function fetchModelCatalog(): Promise<{ text: ModelOption[], image: ModelOption[] }> {
  const res = await fetch(OPENROUTER_MODELS_URL)
  const json = await res.json().catch(() => null) as { data?: RawModel[] } | null
  if (!res.ok || !json?.data) {
    throw createError({ statusCode: 502, statusMessage: 'Could not reach OpenRouter to list available models' })
  }

  const text: ModelOption[] = []
  const image: ModelOption[] = []

  for (const model of json.data) {
    // "-1" pricing marks OpenRouter's auto-routed meta-models — not a real,
    // single model, so not a sensible pin for this app's purposes.
    if (model.pricing?.prompt === '-1') continue

    const input = model.architecture?.input_modalities ?? []
    const output = model.architecture?.output_modalities ?? []

    if (output.includes('image')) {
      image.push({ id: model.id, name: model.name, priceLabel: priceLabelFor(model, 'image') })
    }
    else if (input.includes('image') && output.includes('text')) {
      text.push({ id: model.id, name: model.name, priceLabel: priceLabelFor(model, 'text') })
    }
  }

  text.sort((a, b) => a.name.localeCompare(b.name))
  image.sort((a, b) => a.name.localeCompare(b.name))
  return { text, image }
}
