/**
 * The store's currency is Moroccan Dirham (MAD), displayed with the
 * colloquial "DH" suffix rather than the ISO code or a "$" symbol
 * (e.g. "599 DH", matching how prices are shown on hodhodshop.com).
 * All prices are stored as integer minor units (centimes) in the database.
 */
export function formatPrice(cents: number): string {
  const amount = cents / 100
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${formatted} DH`
}
