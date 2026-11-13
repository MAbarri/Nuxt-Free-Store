import { eq, sql } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { storeSettings, categories } from '../database/schema'
import type { H3Event } from 'h3'
import { generateHomepageCopy, translateSettingsContent } from '../utils/openrouter'
import { resolveLocaleFromEvent, type TranslatableLocale } from '../utils/locale'

const DEFAULTS = {
  storeName: 'Atelier Élégance',
  tagline: 'Thoughtfully made clothing, delivered to your door.',
  logoUrl: null as string | null,
  accentColor: '#bb6540',
  defaultShippingFee: 500, // minor currency unit (cents)
  announcementBar: 'Nouvelle collection · Découvrez votre prochain coup de cœur',
  hero: {
    title: 'New season, quietly considered',
    subtitle: 'Clothing made from natural fibers, designed to last beyond the season.',
    imageUrl: null as string | null,
    // Optional override shown instead of imageUrl on narrow (mobile) screens,
    // for a hero photo that's cropped/composed for a portrait aspect ratio.
    // Falls back to imageUrl when not set.
    mobileImageUrl: null as string | null,
    ctaLabel: 'Shop the collection',
    ctaHref: '/products',
  },
  promo: {
    title: 'Cash on delivery, everywhere we ship',
    subtitle: 'Pay when your order arrives — no card required.',
  },
  trustBadges: [
    { icon: '◇', label: 'Paiement à la livraison' },
    { icon: '↗', label: 'Livraison partout au Maroc' },
    { icon: '↺', label: 'Échange selon conditions' },
  ] as Array<{ icon?: string, label: string }>,
  analytics: {
    // Public-safe tracking ids, shown in the storefront's HTML either way —
    // fine to store alongside the rest of the settings. The Facebook
    // Conversion API access token is sensitive and lives as a Cloudflare
    // secret instead (see server/types/env.d.ts), never in this table.
    gaMeasurementId: null as string | null,
    fbPixelId: null as string | null,
    fbConversionsApiEnabled: false,
  },
}

export type StoreSettings = typeof DEFAULTS

export interface SettingsTranslation {
  tagline?: string | null
  announcementBar?: string | null
  hero?: { title?: string | null, subtitle?: string | null, ctaLabel?: string | null } | null
  promo?: { title?: string | null, subtitle?: string | null } | null
  trustBadges?: Array<{ label: string | null }> | null
}

function translationKey(locale: TranslatableLocale) {
  return `settings_translation_${locale}` as const
}

function applyTranslation(base: StoreSettings, translation: SettingsTranslation | null): StoreSettings {
  if (!translation) return base
  return {
    ...base,
    tagline: translation.tagline ?? base.tagline,
    announcementBar: translation.announcementBar !== undefined ? translation.announcementBar : base.announcementBar,
    hero: {
      ...base.hero,
      title: translation.hero?.title ?? base.hero.title,
      subtitle: translation.hero?.subtitle ?? base.hero.subtitle,
      ctaLabel: translation.hero?.ctaLabel ?? base.hero.ctaLabel,
    },
    promo: {
      title: translation.promo?.title ?? base.promo.title,
      subtitle: translation.promo?.subtitle ?? base.promo.subtitle,
    },
    trustBadges: base.trustBadges.map((badge, i) => ({ ...badge, label: translation.trustBadges?.[i]?.label ?? badge.label })),
  }
}

export const settingsService = {
  /** Raw French/base settings, ignoring the visitor's locale — used by admin and as the translation source. */
  async getBase(event: H3Event): Promise<StoreSettings> {
    const db = useDb(event)
    const rows = await db.select().from(storeSettings)
    // Exclude the settings_translation_* rows themselves — they're internal
    // storage for en/ar overrides, not part of the public/base settings shape.
    const overrides = Object.fromEntries(
      rows.filter(row => !row.key.startsWith('settings_translation_')).map(row => [row.key, row.value]),
    )
    return { ...DEFAULTS, ...overrides } as StoreSettings
  },

  /** Public, non-sensitive settings safe to expose to the storefront, resolved to the visitor's language. */
  async getPublicSettings(event: H3Event): Promise<StoreSettings> {
    const base = await this.getBase(event)
    const locale = resolveLocaleFromEvent(event)
    if (locale === 'fr') return base
    const translation = await this.getTranslation(event, locale)
    return applyTranslation(base, translation)
  },

  /** Admin view: the raw French base plus every stored translation, for the settings editor's locale tabs. */
  async getAdminSettings(event: H3Event) {
    const base = await this.getBase(event)
    const [en, ar] = await Promise.all([this.getTranslation(event, 'en'), this.getTranslation(event, 'ar')])
    return { ...base, translations: { en, ar } }
  },

  async getTranslation(event: H3Event, locale: TranslatableLocale): Promise<SettingsTranslation | null> {
    const db = useDb(event)
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, translationKey(locale))).limit(1)
    return (row?.value as SettingsTranslation) ?? null
  },

  async upsertTranslation(event: H3Event, locale: TranslatableLocale, input: SettingsTranslation): Promise<SettingsTranslation> {
    const db = useDb(event)
    const existing = await this.getTranslation(event, locale) ?? {}
    const merged = { ...existing, ...input }
    const now = new Date()
    await db.insert(storeSettings)
      .values({ key: translationKey(locale), value: merged, updatedAt: now })
      .onConflictDoUpdate({ target: storeSettings.key, set: { value: merged, updatedAt: now } })
    return merged
  },

  async set(event: H3Event, key: keyof StoreSettings, value: unknown): Promise<void> {
    const db = useDb(event)
    const now = new Date()
    // Drizzle's `json` text-column mode only runs its own JSON.stringify when
    // the value isn't exactly `null` — a top-level `null` (e.g. logoUrl: null,
    // announcementBar: null) is instead bound as a raw SQL NULL, which then
    // violates this column's NOT NULL constraint. Pre-serializing it ourselves
    // sidesteps that: `sql\`${...}\`` embeds a plain string param ("null"),
    // never touching the column's special-cased null handling.
    const storedValue = value === null ? sql`${JSON.stringify(value)}` : value
    await db
      .insert(storeSettings)
      .values({ key, value: storedValue, updatedAt: now })
      .onConflictDoUpdate({ target: storeSettings.key, set: { value: storedValue, updatedAt: now } })
  },

  /** Admin-facing partial update — writes only the keys provided. */
  async updateMany(event: H3Event, input: Partial<StoreSettings>): Promise<StoreSettings> {
    for (const [key, value] of Object.entries(input)) {
      await this.set(event, key as keyof StoreSettings, value)
    }
    return this.getBase(event)
  },

  /** Writes fresh French homepage copy with AI, reflecting the actual store (not placeholder text). Saves immediately, still editable afterward. */
  async aiGenerateCopy(event: H3Event) {
    const base = await this.getBase(event)
    const db = useDb(event)
    const categoryRows = await db.select({ name: categories.name }).from(categories)
    const { data, cost } = await generateHomepageCopy(event, {
      storeName: base.storeName,
      categoryNames: categoryRows.map(c => c.name),
    })

    await this.updateMany(event, {
      tagline: data.tagline,
      announcementBar: data.announcementBar,
      hero: { ...base.hero, title: data.hero.title, subtitle: data.hero.subtitle, ctaLabel: data.hero.ctaLabel },
      promo: data.promo,
      trustBadges: data.trustBadges,
    })

    return { settings: await this.getBase(event), cost }
  },

  /** Translates the current French homepage copy into the given locales (both by default). Saves immediately, still editable afterward. */
  async aiTranslate(event: H3Event, locales: TranslatableLocale[] = ['en', 'ar']) {
    const base = await this.getBase(event)
    let cost = 0
    const translations: Partial<Record<TranslatableLocale, SettingsTranslation>> = {}

    for (const locale of locales) {
      const { data, cost: callCost } = await translateSettingsContent(event, {
        targetLocale: locale,
        tagline: base.tagline,
        announcementBar: base.announcementBar,
        hero: base.hero,
        promo: base.promo,
        trustBadges: base.trustBadges,
      })
      cost += callCost
      translations[locale] = await this.upsertTranslation(event, locale, data)
    }

    return { translations, cost }
  },
}
