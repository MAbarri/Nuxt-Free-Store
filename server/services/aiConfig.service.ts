import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { useDb } from '../utils/db'
import { storeSettings } from '../database/schema'

/**
 * Admin-configurable AI model choice + logo-watermark toggle, stored in the
 * same key-value `store_settings` table as the rest of the store config, but
 * under an `ai_config_` prefix that `settingsService.getBase()` explicitly
 * excludes (same treatment as `marketing_*`) — these are internal knobs, not
 * part of the public/storefront settings payload.
 *
 * Deliberately its own tiny service (not folded into settingsService) so
 * `server/utils/openrouter.ts` — which every AI feature in the app funnels
 * through — can import it without a circular dependency: settingsService
 * itself imports from openrouter.ts.
 */
const TEXT_MODEL_KEY = 'ai_config_text_model'
const IMAGE_MODEL_KEY = 'ai_config_image_model'
const WATERMARK_ENABLED_KEY = 'ai_config_logo_watermark_enabled'

// Known-good defaults: a cheap multimodal chat model (vision + text, used for
// both reading reference photos and pure-text generation) and an
// image-to-image model that honors OpenRouter's `input_references` param,
// which is what makes "same garment, new angle" carousels possible.
export const DEFAULT_TEXT_MODEL = 'google/gemini-2.5-flash'
export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash-image'

export const AI_CONFIG_KEY_PREFIX = 'ai_config_'

export interface AiConfig {
  textModel: string
  imageModel: string
  /** Whether AI-generated product photos should include the store logo as a small corner watermark (see media.ts's R2 logo lookup). Defaults to on. */
  logoWatermarkEnabled: boolean
}

async function readValue<T>(event: H3Event, key: string): Promise<T | undefined> {
  const db = useDb(event)
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1)
  return row?.value as T | undefined
}

async function writeValue(event: H3Event, key: string, value: unknown): Promise<void> {
  const db = useDb(event)
  const now = new Date()
  const storedValue = value === null ? sql`${JSON.stringify(value)}` : value
  await db.insert(storeSettings)
    .values({ key, value: storedValue, updatedAt: now })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: storedValue, updatedAt: now } })
}

export const aiConfigService = {
  async getConfig(event: H3Event): Promise<AiConfig> {
    const [textModel, imageModel, logoWatermarkEnabled] = await Promise.all([
      readValue<string>(event, TEXT_MODEL_KEY),
      readValue<string>(event, IMAGE_MODEL_KEY),
      readValue<boolean>(event, WATERMARK_ENABLED_KEY),
    ])
    return {
      textModel: textModel || DEFAULT_TEXT_MODEL,
      imageModel: imageModel || DEFAULT_IMAGE_MODEL,
      logoWatermarkEnabled: logoWatermarkEnabled ?? true,
    }
  },

  /** Just the text model id — the hot path used by every `chatJson` call in openrouter.ts. */
  async getTextModel(event: H3Event): Promise<string> {
    return (await readValue<string>(event, TEXT_MODEL_KEY)) || DEFAULT_TEXT_MODEL
  },

  /** Just the image model id — the hot path used by every `generateProductImage` call in openrouter.ts. */
  async getImageModel(event: H3Event): Promise<string> {
    return (await readValue<string>(event, IMAGE_MODEL_KEY)) || DEFAULT_IMAGE_MODEL
  },

  async updateConfig(event: H3Event, input: Partial<AiConfig>): Promise<AiConfig> {
    if (input.textModel !== undefined) await writeValue(event, TEXT_MODEL_KEY, input.textModel)
    if (input.imageModel !== undefined) await writeValue(event, IMAGE_MODEL_KEY, input.imageModel)
    if (input.logoWatermarkEnabled !== undefined) await writeValue(event, WATERMARK_ENABLED_KEY, input.logoWatermarkEnabled)
    return this.getConfig(event)
  },
}
