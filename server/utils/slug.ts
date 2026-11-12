export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

/**
 * Appends a short random suffix to a slug, used when the base slug
 * already exists for another record.
 */
export function withUniqueSuffix(slug: string): string {
  const suffix = crypto.randomUUID().slice(0, 6)
  return `${slug}-${suffix}`
}
