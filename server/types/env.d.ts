// Ambient Cloudflare bindings for this Worker. Keep in sync with wrangler.jsonc.
// Mirrors what `wrangler types` would generate; declared by hand since this
// project manages wrangler.jsonc manually (see wrangler.jsonc notes).
interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  CACHE: KVNamespace
  SESSION_COOKIE_NAME: string
}
