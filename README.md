# Atelier — Fashion E-commerce Platform

## Why this project exists

My wife wanted to start selling clothing, cash-on-delivery, in Morocco. Every
time she had a new product to put online, she needed a landing page, product
photos, ad copy, and social media posts — and every time, that meant pulling
me in to build it for her.

So instead of doing that over and over, I built her a store she can run
entirely on her own: she adds a product and a reference photo, and the app
handles the landing page, the AI-generated photos, the product copy, the
translations, and the social media posts — no developer required in the
loop anymore. Everything below grew out of that one goal.

It's a full-stack Nuxt 4 + Cloudflare Workers application: customer-facing
storefront, a complete admin dashboard, and an AI layer (via OpenRouter) that
handles the content-creation work a small solo merchant doesn't have time
for. See `SPEC.md` for the original technical specification and
`docs/DEPLOYMENT.md` for one-time Cloudflare setup.

---

## Features

### Storefront
- Editorial, mobile-first storefront (homepage, categories, product listing
  with filter/sort/pagination, product detail pages, cart, checkout).
- Product variants (size, color, etc.) with color swatches, stock-aware
  add-to-cart, a quick-view modal, related products, and per-category/
  per-product size guides.
- Two selectable product page layouts per product: a classic e-commerce
  layout or a long-form "landing page" layout (hero + benefits + lifestyle
  photo blocks) better suited to single-product, ad-driven selling.
- Cash-on-delivery checkout: delivery details, server-side stock/price
  revalidation, shipping fee calculation, order confirmation — no payment
  gateway, no account required to buy.
- Guest-friendly wishlist and cart, persisted via cookie and merged into an
  account on login.
- Full storefront translation into **French (default), English, and
  Arabic** (with proper RTL layout for Arabic) via an explicit language
  switcher — URLs stay identical across languages, no browser-based
  auto-redirect.
- Google Analytics 4 and Facebook Pixel (+ optional server-side Conversions
  API) wired in, off by default until an admin configures the IDs.

### Admin dashboard
A single responsive dashboard — fully usable from a phone — covering:

- **Catalog**: products, categories, attributes (with swatch support), size
  guides, and inventory (stock adjustments, low-stock alerts, adjustment
  history).
- **Sales**: orders (search/filter, status + payment tracking, internal
  notes, cancellation with stock restore), customers (profiles, order
  history, notes), and shipping (per-city/region rates, free-shipping
  thresholds).
- **Marketing**: a dashboard overview, an AI social media post generator,
  and read-only Meta/TikTok ads insight dashboards (once connected).
- **Settings**: store branding (name, logo, favicon, accent color),
  homepage copy, shipping defaults, analytics connections, and the AI model
  configuration described below.

### AI features (OpenRouter)
The part that actually replaced me as the "developer in the loop":

- **AI product creation wizard**: upload one reference photo, and the AI
  writes the product name, descriptions, and suggested pricing, then
  generates a full set of additional product photos (different angles,
  settings, and model styling) from a categorized, searchable scene
  library — all consistent with the original garment.
- **AI landing page content**: AI-written homepage copy (tagline,
  hero/promo text, trust badges) and AI-generated lifestyle photo blocks
  with captions for a product's landing-style page.
- **Catalog translation**: one click translates any product or category
  into English and Arabic, reusing the same content structure as the
  French original.
- **SEO backfill**: generates SEO titles/descriptions for existing products
  that don't have one yet.
- **Social media post generator**: pick a product, a categorized "post
  angle" (promotional, product highlight, engagement, seasonal, social
  proof, brand story — 14 types), a platform, and a language; the AI
  writes a ready-to-post caption and hashtags. Optional free-text details
  (a discount %, an occasion) are worked in exactly as given, never
  invented. Every generated post is **saved automatically** to a history
  list in the admin, with copy and delete actions.
- **Logo watermarking**: when a store logo is configured, AI-generated
  product/lifestyle photos automatically carry it as a small watermark in
  the bottom-right corner — on by default, toggleable in Settings.
- **Configurable AI models**: the text and image models used across every
  AI feature are picked from OpenRouter's live model catalog directly in
  Settings (searchable, with live pricing), instead of being hardcoded —
  swap models store-wide without touching code.

### Marketing integrations
- Google Analytics 4 and Facebook Pixel / Conversions API (storefront-only,
  never loaded in `/admin`).
- Read-only Meta Ads and TikTok Ads insight dashboards, gated behind
  optional access-token secrets — shows spend/performance once connected,
  does not manage campaigns.

### Platform / engineering
- Nuxt 4 + Nitro on Cloudflare Workers (`cloudflare_module`), with
  Cloudflare D1 (database), R2 (media storage), and KV bindings — runs
  entirely on Cloudflare's free tier.
- Drizzle ORM with versioned migrations, Zod validation on every server
  route, session-based auth with role-based access (customer/admin),
  password hashing via Web Crypto (no Node-only crypto).
- Consistent success/error API envelope, server-side authorization on every
  admin/customer-scoped route (the frontend route guard is UX only).

---

## Requirements

- Node 22+ (see `.nvmrc`)
- pnpm

## Getting started

```sh
pnpm install
pnpm db:generate       # regenerate migrations after a schema change
pnpm db:migrate:local   # apply migrations to the local D1 emulation
pnpm dev
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Local dev server with emulated Cloudflare bindings |
| `pnpm build` | Production build (Nitro `cloudflare-module`) |
| `pnpm preview` | Preview the built Worker with `wrangler dev` |
| `pnpm test` | Run Vitest (executes inside the Workers runtime) |
| `pnpm db:generate` | Generate Drizzle migrations from the schema |
| `pnpm db:migrate:local` / `db:migrate:remote` | Apply migrations |
| `pnpm deploy` | Manual build + deploy (normally handled by Workers Builds, see `docs/DEPLOYMENT.md`) |
