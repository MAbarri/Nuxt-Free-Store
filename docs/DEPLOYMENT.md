# Deployment & one-time Cloudflare setup

This project deploys as a single Cloudflare Worker (Nitro `cloudflare-module`
preset). Local development already runs against emulated D1/R2/KV bindings
(Miniflare, via Nuxt's built-in Cloudflare dev emulation) — no login
required for that. The steps below are only needed once, to provision real
resources on your Cloudflare account and wire up zero-effort deploys.

## 1. Log in to Cloudflare

```sh
npx wrangler login
```

## 2. Create the real resources

```sh
npx wrangler d1 create fashion_store_db
npx wrangler r2 bucket create fashion-store-media
npx wrangler kv namespace create CACHE
```

Each command prints an id. Copy them into `wrangler.jsonc`:

- `d1_databases[0].database_id` ← the D1 `database_id`
- `kv_namespaces[0].id` ← the KV namespace id
- R2 needs no id, the `bucket_name` is enough.

## 3. Apply migrations to the remote database

```sh
pnpm db:migrate:remote
```

Re-run this (or let CI run it) after every schema change, in addition to
`pnpm db:migrate:local` for your local environment.

## 4. Connect Cloudflare Workers Builds (automatic deploy on push)

In the Cloudflare dashboard: **Workers & Pages → your Worker → Settings →
Builds**, connect this GitHub repository. Every push to the default branch
now builds (`nuxi build`) and deploys automatically — no manual `wrangler
deploy` needed, and no third-party CLI/service sits in the deploy path (see
SPEC.md §2, "Deployment mechanism").

## 5. Secrets

Non-sensitive config lives in `wrangler.jsonc` under `vars`. Actual secrets
are set with:

```sh
npx wrangler secret put SECRET_NAME
```

never committed to `wrangler.jsonc`. Currently in use:

- `OPENROUTER_API_KEY` — powers the AI features (catalog translation, the AI
  product creation wizard). Required in production via the command above,
  and locally via a `.dev.vars` entry (gitignored, see `.dev.vars` in the
  repo root). Without it, every AI endpoint returns a clean 500 rather than
  crashing, but none of the AI features work.
- `FB_CONVERSIONS_ACCESS_TOKEN` — optional. Enables server-side Facebook
  Conversion API `Purchase` events (Settings → Analytics in the admin also
  needs "Enable server-side Conversion API" turned on, and a Facebook Pixel
  ID set). Get the token from Meta Events Manager → your Pixel → Settings →
  Conversions API → "Generate access token". Without it, Conversion API
  calls simply no-op; checkout and the client-side Pixel are unaffected.
- `META_ADS_ACCESS_TOKEN` — optional. Powers the read-only Meta ads manager
  dashboard (Marketing → Meta ads manager). A Marketing API System User
  access token with `ads_read` on the ad account entered on that page. Get
  it from Meta Business Settings → Users → System Users → your system user →
  Generate token (select the ad account and `ads_read`). Without it, that
  page simply shows "not connected".
- `TIKTOK_ADS_ACCESS_TOKEN` — optional. Powers the read-only TikTok ads
  manager dashboard (Marketing → TikTok ads manager). An access token for
  the advertiser entered on that page, from a TikTok for Business Marketing
  API app. Without it, that page simply shows "not connected".

## Manual fallback

If you ever need to deploy by hand instead of via Workers Builds:

```sh
pnpm deploy
```
