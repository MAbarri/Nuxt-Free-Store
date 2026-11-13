// Ambient Cloudflare bindings for this Worker. Keep in sync with wrangler.jsonc.
// Mirrors what `wrangler types` would generate; declared by hand since this
// project manages wrangler.jsonc manually (see wrangler.jsonc notes).
interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  CACHE: KVNamespace
  SESSION_COOKIE_NAME: string
  // Secret — set via `wrangler secret put OPENROUTER_API_KEY` in production,
  // and a .dev.vars entry (gitignored) locally. Powers the AI product
  // creation wizard and catalog translation features.
  OPENROUTER_API_KEY: string
}
