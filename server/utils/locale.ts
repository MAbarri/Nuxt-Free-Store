import { getCookie, type H3Event } from 'h3'

/**
 * The storefront's three UI locales. French is always the base/default
 * content locale — product and category "source of truth" text lives
 * directly on their own tables; `product_translations`/`category_translations`
 * only ever hold 'en'/'ar' override rows (see server/database/schema/catalog.ts).
 */
export type CatalogLocale = 'fr' | 'en' | 'ar'
export type TranslatableLocale = 'en' | 'ar'

/**
 * Reads the same `store_locale` cookie the storefront's language switcher
 * already writes (see app/plugins/locale.ts) — no extra plumbing needed to
 * know which language a storefront request is for. Defaults to French,
 * consistent with "no browser auto-detection" elsewhere in the app.
 */
export function resolveLocaleFromEvent(event: H3Event): CatalogLocale {
  const raw = getCookie(event, 'store_locale')
  return raw === 'en' || raw === 'ar' ? raw : 'fr'
}

export interface ProductTranslationRow {
  name: string | null
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  landingBenefits: Array<{ icon?: string, text: string }> | null
  landingBlockCaptions: Array<string | null> | null
}

/**
 * Resolves a product's customer-facing fields for `locale`, falling back
 * field-by-field to the French base content whenever a translation is
 * missing or incomplete — a half-translated product never shows blank text.
 */
export function applyProductTranslation<T extends {
  name: string
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  landingBenefits: Array<{ icon?: string, text: string }> | null
  landingBlocks: Array<{ imageUrl: string, caption?: string }> | null
}>(base: T, translation: ProductTranslationRow | null | undefined, locale: CatalogLocale): T {
  if (locale === 'fr' || !translation) return base

  const landingBlocks = base.landingBlocks && translation.landingBlockCaptions
    ? base.landingBlocks.map((block, i) => ({
        ...block,
        caption: translation.landingBlockCaptions?.[i] ?? block.caption,
      }))
    : base.landingBlocks

  return {
    ...base,
    name: translation.name ?? base.name,
    shortDescription: translation.shortDescription ?? base.shortDescription,
    description: translation.description ?? base.description,
    seoTitle: translation.seoTitle ?? base.seoTitle,
    seoDescription: translation.seoDescription ?? base.seoDescription,
    landingBenefits: translation.landingBenefits ?? base.landingBenefits,
    landingBlocks,
  }
}

export interface CategoryTranslationRow {
  name: string | null
  description: string | null
}

export function applyCategoryTranslation<T extends { name: string, description: string | null }>(
  base: T,
  translation: CategoryTranslationRow | null | undefined,
  locale: CatalogLocale,
): T {
  if (locale === 'fr' || !translation) return base
  return {
    ...base,
    name: translation.name ?? base.name,
    description: translation.description ?? base.description,
  }
}
