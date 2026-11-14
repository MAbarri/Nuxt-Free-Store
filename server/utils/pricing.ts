/**
 * Per-product quantity-break discount ("buy X+, save Y%" — Roadmap Phase D).
 * Applies to one cart line / direct-order line based on its own quantity —
 * not combined across different variants of the same product, kept simple
 * deliberately. `unitPrice` and the returned subtotal are both cents.
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
