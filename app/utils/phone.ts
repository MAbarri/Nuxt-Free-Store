/**
 * Client-side copy of the Moroccan phone normalization logic in
 * `server/utils/phone.ts` (duplicated rather than imported — `app/` and
 * `server/` are separate build contexts in Nuxt). Keep both in sync if the
 * normalization rules ever change.
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

  if (/^[5-7]\d{8}$/.test(digits)) return `0${digits}`
  if (/^0[5-7]\d{8}$/.test(digits)) return digits

  return digits || original
}

/** Canonical number in international-digits form (no `+`), for `wa.me` links. */
export function toInternationalDigitsMA(raw: string): string {
  const local = normalizePhoneMA(raw)
  if (/^0[5-7]\d{8}$/.test(local)) return `212${local.slice(1)}`

  const digits = local.replace(/\D/g, '')
  if (/^212\d{9}$/.test(digits)) return digits
  return digits
}
