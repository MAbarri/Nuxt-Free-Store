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
  // Secret, optional — set via `wrangler secret put FB_CONVERSIONS_ACCESS_TOKEN`
  // in production, and a .dev.vars entry (gitignored) locally, once you have a
  // Facebook Conversion API access token. Server-side Purchase event tracking
  // simply no-ops (never breaks checkout) while this is unset.
  FB_CONVERSIONS_ACCESS_TOKEN?: string
  // Secret, optional — set via `wrangler secret put META_ADS_ACCESS_TOKEN`.
  // A Meta Marketing API System User access token with `ads_read` on the ad
  // account configured in Marketing → Meta ads manager. Insights/campaigns
  // simply show "not connected" while this is unset.
  META_ADS_ACCESS_TOKEN?: string
  // Secret, optional — set via `wrangler secret put TIKTOK_ADS_ACCESS_TOKEN`.
  // A TikTok for Business Marketing API access token for the advertiser
  // configured in Marketing → TikTok ads manager. Insights/campaigns simply
  // show "not connected" while this is unset.
  TIKTOK_ADS_ACCESS_TOKEN?: string
}
