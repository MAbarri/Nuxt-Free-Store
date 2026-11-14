/**
 * Picks the "default" variant for a product when the caller doesn't ask the
 * customer to choose one explicitly (e.g. a cross-sell companion added with
 * a single tap/checkbox — Roadmap Phase D). Prefers an active variant with
 * stock; falls back to the first active variant (so it can still be shown,
 * just unavailable); falls back further to just the first variant — only
 * returns null if the product has no variants at all (shouldn't happen, see
 * the "every product has a default variant" invariant in AI_BUILD_PROGRESS.md).
 */
export function pickDefaultVariant<T extends { isActive: boolean, stock: number }>(variants: T[]): T | null {
  if (!variants.length) return null
  return variants.find(v => v.isActive && v.stock > 0) ?? variants.find(v => v.isActive) ?? variants[0]!
}
