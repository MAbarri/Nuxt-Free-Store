/**
 * Generates an opaque random id. Used for primary keys instead of
 * auto-increment integers, so ids are safe to expose (e.g. order ids) and
 * generation never depends on a round-trip to the database.
 */
export function generateId(prefix?: string): string {
  const uuid = crypto.randomUUID()
  return prefix ? `${prefix}_${uuid}` : uuid
}

function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

export { randomToken }
