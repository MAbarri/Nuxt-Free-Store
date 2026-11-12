const ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH_BITS,
  )
  return new Uint8Array(bits)
}

/**
 * Hashes a password with PBKDF2 via Web Crypto's SubtleCrypto — no Node-only
 * crypto module, so this runs unmodified in the Cloudflare Workers runtime.
 * Encoded as `pbkdf2$<iterations>$<saltB64>$<hashB64>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await deriveKey(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const [, iterationsRaw, saltB64, hashB64] = parts
  const iterations = Number(iterationsRaw)
  if (!Number.isFinite(iterations)) return false

  const salt = fromBase64(saltB64)
  const expected = fromBase64(hashB64)
  const actual = await deriveKey(password, salt, iterations)
  if (actual.length !== expected.length) return false

  // Constant-time comparison to avoid timing attacks.
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}
