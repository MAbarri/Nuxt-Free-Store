/**
 * Canonicalizes a Moroccan phone number to local format: a leading `0`
 * followed by the 9-digit national number (e.g. `0612345678`).
 *
 * Handles `+212`, `00212`, and bare `212` prefixes plus arbitrary
 * spaces/dashes/parens/dots. Never throws — falls back to a best-effort
 * cleaned digit string for anything that doesn't match a recognizable
 * Moroccan pattern, so no customer-submitted phone number is ever dropped.
 * This is the canonical identity key for `customer_profiles.phone`.
 */
export function normalizePhoneMA(raw: string): string {
  const original = (raw ?? '').trim()
  if (!original) return original

  let cleaned = original.replace(/[\s\-().]/g, '')

  if (cleaned.startsWith('+212')) cleaned = cleaned.slice(4)
  else if (cleaned.startsWith('00212')) cleaned = cleaned.slice(5)
  else if (/^212\d{9}$/.test(cleaned)) cleaned = cleaned.slice(3)
  else if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)

  const digits = cleaned.replace(/\D/g, '')

  // 9-digit national number without the leading 0 (e.g. after stripping +212).
  if (/^[5-7]\d{8}$/.test(digits)) return `0${digits}`
  // Already in local 0XXXXXXXXX form.
  if (/^0[5-7]\d{8}$/.test(digits)) return digits

  // Fallback: best-effort cleaned digits, never throws/drops data.
  return digits || original
}

/**
 * Same canonical number in international-digits form with no leading `+`
 * (e.g. `212612345678`) — the format `wa.me` links expect (used by Phase B's
 * "Confirm via WhatsApp" button).
 */
export function toInternationalDigitsMA(raw: string): string {
  const local = normalizePhoneMA(raw)
  if (/^0[5-7]\d{8}$/.test(local)) return `212${local.slice(1)}`

  // Fallback: if it already looks international, leave it; otherwise just
  // strip to digits so the caller at least gets something wa.me can try.
  const digits = local.replace(/\D/g, '')
  if (/^212\d{9}$/.test(digits)) return digits
  return digits
}
