/**
 * Client-side copy of the quantity-discount math in
 * `server/utils/pricing.ts` — used for a live "X DH (Y% off applied)"
 * preview under the quantity selector, while the actual order total is
 * always computed authoritatively by the server (cart/checkout responses).
 */
export function applyQuantityDiscount(
  unitPrice: number,
  quantity: number,
  minQty?: number | null,
  percent?: number | null,
): { subtotal: number, discountApplied: boolean } {
  const base = unitPrice * quantity
  if (!minQty || !percent || quantity < minQty) {
    return { subtotal: base, discountApplied: false }
  }
  return { subtotal: Math.round(base * (1 - percent / 100)), discountApplied: true }
}
