# AI Build Progress — Fashion E-commerce Platform

This file is a handoff document for continuing this build in a fresh/compacted
conversation. Read this alongside `SPEC.md` (the full project specification —
read that first for requirements, data model, and the overall plan). This file
covers **what's actually been built, how, and what's left**.

Git history is also a reliable source of truth: one commit per phase, in
order, each with a descriptive message. Run `git log --oneline --reverse` to
see them.

---

## Current status: Phases 1–10 + settings page done, Phase 11 remaining

| Phase | Status |
|---|---|
| 1. Foundation | ✅ Done |
| 2. Catalog | ✅ Done |
| 3. Storefront browsing | ✅ Done |
| 4. Cart & wishlist | ✅ Done |
| 5. Checkout & COD | ✅ Done |
| 6. Admin dashboard shell | ✅ Done |
| 7. Order management | ✅ Done |
| 8. Customer management | ✅ Done |
| 9. Shipping configuration | ✅ Done |
| 10. Inventory management | ✅ Done |
| Store settings admin page (gap, not a numbered phase) | ✅ Done |
| Landing product pages (gap, not a numbered phase) | ✅ Done |
| Currency switch to MAD + real product import (gap, not a numbered phase) | ✅ Done |
| Storefront i18n: French/English/Arabic + RTL (gap, not a numbered phase) | ✅ Done |
| Real web fonts for fr/en + Arabic pairing (gap, not a numbered phase) | ✅ Done |
| AI features: OpenRouter integration, catalog translation, AI product wizard (gap, not a numbered phase) | ✅ Done |
| 11. Testing, security review, and deployment | ❌ Not started |

**Decisions made on the two previously-identified gaps (user confirmed):**
- **Customer-facing auth pages** (`/login`, `/register`, `/account`) are
  **deliberately deferred** — not building these now, may revisit later. The
  backend (`/api/auth/*`) still works and is tested via curl, there's just no
  storefront UI for it.
- **Wishlist** was **hidden, not removed**: the header heart icon/badge and
  the product-detail-page "Add to wishlist" button were removed from
  `app/components/StorefrontHeader.vue` and
  `app/pages/products/[slug].vue`, since there's no login flow for users to
  reliably keep a wishlist across sessions right now. The backend
  (`/api/wishlist/*`, `wishlist.service.ts`), the `useWishlist` composable,
  and the `/wishlist` page itself are **untouched** and still fully
  functional if hit directly — re-enabling is just re-adding the two UI
  entry points. The header's `/account` icon was removed too, for the same
  reason (no account pages exist yet).
- **Store settings admin page** (`/admin/settings`) is **done** (see below).

Recommended order to continue: **Phase 11** is all that's left.

---

## Tech stack (as built)

- Nuxt 4.6, Vue 3, TypeScript, Nitro preset `cloudflare-module`
- Tailwind CSS v4 + Nuxt UI v4 (editorial-minimalist design tokens: Fraunces
  display font, Inter body font, bone/stone neutrals, "clay" terracotta
  accent — see `app/assets/css/main.css` and `app/app.config.ts`)
- Drizzle ORM + Cloudflare D1 (24 tables, see `server/database/schema/`)
- Cloudflare R2 for product images, served via `server/routes/media/[...path].get.ts`
- pnpm, Node 22 (see `.nvmrc` — **must** `nvm use 22` before any command;
  Node 20 is too old for Vitest 5/Vite 8)
- Vitest via `@cloudflare/vitest-plugin` (tests run inside real `workerd`,
  not mocked) — note the package was renamed from
  `@cloudflare/vitest-pool-workers`, keep using `@cloudflare/vitest-plugin`
- Custom auth: Web Crypto PBKDF2 password hashing, D1-backed sessions,
  httpOnly cookies — no third-party auth library

## Local dev workflow

```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
pnpm install
pnpm db:generate          # after any schema change in server/database/schema/
pnpm db:migrate:local      # apply to local D1 (wrangler/Miniflare state)
pnpm dev --port 3300       # dev server with Cloudflare bindings emulated
pnpm build                 # production build check
pnpm test                  # vitest (24 tests as of the Landing product pages feature)
```

To promote a registered user to admin for manual testing (no seed script
exists yet):
```sh
npx wrangler d1 execute fashion_store_db --local --command \
  "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

**Known test data in the local D1 state** (`.wrangler/state/v3`, not
committed): a product "Linen Midi Dress" (slug `linen-midi-dress`) with
Color/Size variants, category "Dresses", an admin user, several test
customers, and a few placed/cancelled orders from manual verification during
Phases 5–8. This is disposable dev data, not a seed script — feel free to
wipe `.wrangler/state/v3` for a clean slate if needed (migrations will need
reapplying with `pnpm db:migrate:local`).

**Shell gotcha**: this environment's shell is **zsh**, which does not
word-split unquoted variables like bash. Never store a flag+value combo in
one variable (e.g. `C="-b cookies.txt"` then `curl $C ...`) — zsh passes it
as a single broken argv token and curl silently drops the cookie. Always
write flags literally: `curl -b /tmp/cookies.txt ...`, or put only the bare
path in a variable.

---

## Architectural conventions (follow these for consistency)

### Server-side layering
`server/api/**` (thin, wrapped in `defineApiHandler`) → `server/services/**`
(business logic, auth checks, orchestration) → `server/repositories/**`
(Drizzle queries only, no business logic) → `server/database/schema/**`.

### API response envelope
Every route uses `defineApiHandler` from `server/utils/handler.ts`, which
wraps the result as `{ success: true, data }` or `{ success: false, error:
{ statusCode, message, details } }`. Never return raw objects from a route
file — always `export default defineApiHandler(async (event) => {...})`.

### Relative import path depth (common mistake, watch for it)
Nitro route files are nested under `server/api/...` and relative imports to
`server/utils`, `server/services` etc. must count directory depth correctly.
E.g. `server/api/admin/products/[id]/variants/index.post.ts` needs
`'../../../../../utils/handler'` (5 levels up to reach `server/`). Builds
fail loudly (`Cannot resolve ...`) if this is wrong — always run `pnpm
build` after adding new nested routes.

### Auth
- `requireAuthUser(event)` / `requireAdmin(event)` from
  `server/utils/session.ts` — throws 401/403. Call at the top of every
  protected route.
- `getAuthUser(event)` caches on `event.context.auth` so repeated calls in
  one request don't re-hit the DB.
- `resolveCustomerProfileId(event)` in `server/utils/customer.ts` — shared
  helper used by cart/wishlist/checkout to resolve a logged-in customer's
  profile id (or null for guests).

### Database access
Always via `useDb(event)` from `server/utils/db.ts`. This returns a Drizzle
client bound to `D1.withSession('first-primary')` — **do not** remove this,
it fixes a real D1 read-replication bug (see "Bugs found and fixed" below).

### Guest identity (cart/wishlist)
`server/utils/guestToken.ts` manages a `guest_id` cookie, separate from the
auth session cookie. `getGuestToken`/`getOrCreateGuestToken` cache on
`event.context.guestToken` — **do not** remove this caching (see bugs below).

### Client-side API calls
Always use the `apiFetch<T>(url, opts)` composable from
`app/composables/useApi.ts`, never raw `$fetch` or `useAsyncData(key, () =>
$fetch(...))`, for anything that might depend on cookies (cart, wishlist,
auth, admin data). `apiFetch` branches to `useRequestFetch()` on the server
specifically to forward cookies during SSR — raw `$fetch` does not do this
automatically (see bugs below). `useFetch`/`useLazyFetch` (the Nuxt
composables, not raw `$fetch`) are also safe since Nuxt handles this
internally for those.

### Shared reactive state
`useCart()` and `useWishlist()` composables (`app/composables/`) wrap
`useState` so the header badge and any page stay in sync without prop
drilling. Call their methods (`addItem`, `updateQuantity`, etc.) rather than
calling `apiFetch` directly against `/api/cart/*`/`/api/wishlist/*` from
page components.

### Money
All prices are **integers in minor currency units (cents)**, both in the DB
and over the API. Admin forms convert to/from dollars for display
(`Math.round(dollars * 100)` on submit, `cents / 100` on load). Never store
floats.

### Variants — "default variant" pattern (important, non-obvious)
Every product always has **at least one variant**, even if the merchant
never defines Size/Color options — this is because stock is tracked at the
variant level only (`product_variants.stock`), not on `products`. See
`server/services/products.service.ts` (`create` auto-creates a default
attribute-less variant) and `server/services/variants.service.ts` (adding
the first *real* attributed variant deletes the auto default; deleting the
last real variant re-creates a default so the product stays orderable). The
storefront product page checks `attributeGroups.length > 0` to decide
whether to show a variant picker UI at all.

### Inventory
`inventoryService.adjustStock(event, variantId, delta, reason, opts)` in
`server/services/inventory.service.ts` is the **single** place stock is ever
changed. It uses a conditional SQL `UPDATE ... WHERE stock + delta >= 0` to
be safe under concurrent requests (tested with 8 concurrent buyers against 5
units of stock). Every caller (checkout, admin manual adjustment, order
cancellation restore) goes through this, logging an `inventory_adjustments`
row every time. **Never** write a raw `UPDATE product_variants SET stock =
...` anywhere else.

### Order status → stock restoration
`server/services/orders.service.ts`: moving an order's status to
`cancelled` or `returned` auto-restores stock for all its items (guarded
against double-restore). Ordinary progression (confirmed → processing →
shipped → delivered) never touches stock.

---

## Bugs found and fixed during the build (do not regress these)

1. **D1 read-after-write consistency**: a session/cart row written in one
   request could be invisible to a read moments later if routed to a stale
   replica. Fixed by always using `env.DB.withSession('first-primary')` in
   `useDb()`.
2. **Cookie set ≠ cookie readable in the same request**: `setCookie()`
   only takes effect on the *next* request; `getCookie()` reading back
   immediately in the same handler sees nothing. Fixed by caching the guest
   token on `event.context.guestToken` the moment it's created (same
   pattern already used for `event.context.auth`).
3. **`carts.guestToken` unique index blocking reuse**: a merged ("converted")
   guest cart used to be kept with `status: 'converted'` but the same
   `guestToken` value, which permanently blocked that guest identity from
   ever starting a new cart (unique index violation). Fixed by deleting the
   guest cart row entirely once merged, instead of just marking it
   converted. Regression test: `tests/unit/cart-merge.test.ts`.
4. **SSR cookie forwarding**: plain global `$fetch` during SSR does **not**
   forward the incoming request's cookies to internal API calls — only
   `useRequestFetch()` (used internally by `useFetch`/`useAsyncData`+proper
   usage) does. This silently broke server-rendered `/cart` and `/wishlist`
   pages (always showed empty). Fixed centrally in `apiFetch` (branches to
   `useRequestFetch()` on the server) and in `AdminTopbar.vue` (switched
   from `useAsyncData(() => $fetch(...))` to `useFetch(...)`).

If something cookie/session-related looks subtly broken again, re-read
these four first.

---

## Data model notes beyond SPEC.md §9

- `product_attributes.display_type`: `'text' | 'select' | 'swatch'`.
  `'swatch'` attributes carry a hex color on each `product_attribute_values`
  row and render as color chips on the storefront.
- `size_guides.content` is a JSON blob: `{ columns: string[], rows:
  Record<string,string>[] }`. Assigned to a category, optionally overridden
  per product (`products.size_guide_id`).
- `orders`/`order_items` always snapshot product/variant data at order time
  (name, SKU, variant label like `"Color: Black / Size: S"`, unit price) —
  never joined live from `products`/`product_variants` for historical
  display.
- `order_number` format: `ORD-YYYYMMDD-XXXXXX` (6 random uppercase
  hex/base36 chars), generated with a uniqueness pre-check + retry loop
  (`server/services/checkout.service.ts`).
- Revenue definition used by the dashboard (`server/services/dashboard.service.ts`):
  sum of `orders.total` **excluding** `cancelled`/`returned`/`failed_delivery`
  statuses. "Pending orders" = any of
  `pending_confirmation/confirmed/processing/shipped`. "Awaiting
  confirmation" = `pending_confirmation` only. These are deliberate
  interpretations of slightly ambiguous brief language — revisit if the user
  wants different definitions.

---

## Testing

24 tests across 6 files in `tests/unit/`, all exercising real business logic
against the real D1 schema (not mocked):

- `password.test.ts` — PBKDF2 hash/verify round trip
- `inventory.test.ts` — concurrency-safe stock adjustment (the 8-vs-5 race
  test), adjustment history
- `cart-merge.test.ts` — guest→account cart merge, quantity combination,
  guest-token-reuse-after-merge regression
- `checkout.test.ts` — order creation, empty-cart rejection, sold-out
  rejection + stock untouched, multi-item rollback-on-partial-failure
- `order-management.test.ts` — stock restoration on cancel, no
  double-restore, restoration on `returned`, no restoration on normal
  progression, independent payment-status updates
- `direct-order.test.ts` — `checkoutService.createDirectOrder` (Landing
  product pages' cart-free order path): creates an order and decrements
  stock, rejects a `standard`-layout product (422), rejects quantity over
  stock leaving stock untouched (409), rejects an unknown product (404)

Run via `pnpm test`. Uses `tests/setup/apply-migrations.ts` +
`vitest.config.ts`'s `cloudflareTest` plugin — migrations are read from
`server/database/migrations/` and applied to the in-memory D1 per test file.

No component/E2E tests exist yet (Phase 11 could add Playwright if desired,
but wasn't in the agreed Vitest-first testing strategy from SPEC.md).

---

## What's left — concrete next steps

### Phase 9: Shipping configuration — ✅ done
Admin CRUD built on top of the pre-existing repository/service:
- `server/schemas/shipping.schema.ts` — zone/rate create & update validation
- Routes under `server/api/admin/shipping/`: `zones/index.{get,post}.ts`,
  `zones/[id].{put,delete}.ts`, `rates/index.post.ts`, `rates/[id].{put,delete}.ts`
- `shippingService` gained admin methods: `listZonesWithRates`, `createZone`,
  `updateZone`, `removeZone`, `createRate`, `updateRate`, `removeRate` (each
  404s on an unknown id); `shippingRepository` gained `findRateById`
- Admin UI `/admin/shipping`: zone cards (name, free-shipping threshold,
  active toggle, edit/delete) each with a nested rates table (city, fee,
  active toggle, edit/delete) and an "Add city rate" action
- Verified end-to-end via curl: create/list/update/toggle/delete zone and
  rate, 404 on unknown zone id, 401 when not authenticated, zone delete
  cascades its rates (FK `onDelete: cascade`)

### Phase 10: Inventory management — ✅ done
- `inventoryService.listVariants(event, { search, page, pageSize })` — joins
  `product_variants` → `products`, plus a second query to attach each
  variant's attribute values (same join pattern as
  `variantsRepository.listByProduct`), paginated, searchable by product name
  or SKU
- `inventoryListQuerySchema` in `server/schemas/inventory.schema.ts`
- Route: `server/api/admin/inventory/index.get.ts` (the existing
  `adjustments.post.ts`, `low-stock.get.ts`, and
  `variants/[variantId]/history.get.ts` routes were already there and
  unchanged)
- Admin UI `/admin/inventory`: paginated/searchable table of every variant
  across the catalog (product name links to its admin product page, SKU,
  attributes, price, stock badge color-coded by level, active state), an
  "adjust stock" modal (reused pattern from the product detail page), and a
  "history" modal listing all adjustments for that variant
- Verified end-to-end via curl: list/search, stock adjustment through the
  new page's endpoint, history reflects the adjustment, SSR page loads

### Wishlist / account — hidden, not removed (user decision)
- Removed from `app/components/StorefrontHeader.vue`: the wishlist heart
  icon/badge and the `/account` user icon
- Removed from `app/pages/products/[slug].vue`: the "add to wishlist" heart
  button and its `toggleWishlist`/`wishlisted` logic
- Left completely untouched: `/api/wishlist/*`, `wishlist.service.ts`,
  `wishlist.repository.ts`, the `useWishlist` composable, and the
  `/wishlist` page (still reachable directly, confirmed `200` via curl) — if
  customer accounts are built later, re-enabling wishlist is just re-adding
  those two UI entry points
- Customer-facing auth pages (`/login`, `/register`, `/account`) remain
  **not built**, by explicit user decision, not a gap to fix next

### Next up: Store settings admin page — ✅ done
- `settingsService.updateMany(event, input)` writes only the keys present in
  the request body via the existing `set()` method
- Routes: `server/api/admin/settings.get.ts` / `.put.ts`, plus
  `server/api/admin/settings/images.post.ts` (multipart upload to R2,
  reuses `uploadImageToR2` with folder `settings`, returns `{ url }` for the
  UI to store in `logoUrl` or `hero.imageUrl`)
- `server/schemas/settings.schema.ts` validates accent color as a hex
  string and the hero/promo object shapes
- `/admin/settings` UI: branding (store name, tagline, logo upload +
  preview, accent color picker), shipping default fee, hero section (title,
  subtitle, CTA label/href, image upload + preview), promo banner
  (title/subtitle)
- Verified end-to-end: admin update → reflected immediately in public
  `/api/store-settings` and the rendered homepage (checked storeName, hero
  title, promo title all changed), invalid hex color rejected with 422,
  non-admin blocked with 401, image upload to R2 returns a working
  `/media/...` url, defaults restored after testing

### Landing product pages (gap, not a numbered phase) — ✅ done
Per-product opt-in alternate storefront template modeled on single-product
ad-funnel landing pages (e.g. hodhodshop.com-style COD stores): a long-form
page with an embedded direct-order form that **fully replaces cart/checkout**
for that one product, plus marketing sections (benefits, lifestyle photos,
trust badges) and a sticky bottom CTA bar. Most products stay on the existing
`standard` cart-based page — this is additive, not a replacement.

- **Data model**: `products.layout_style` (`'standard' | 'landing'`, default
  `'standard'`), `products.landing_benefits` (JSON array of
  `{ icon?, text }`, max 6), `products.landing_blocks` (JSON array of
  `{ imageUrl, caption? }`, max 3) — migration `0001_quick_xorn.sql`.
  `store_settings` gained a `trustBadges` key (JSON array of
  `{ icon?, label }`, max 6, store-wide, shown on every Landing page) with
  three sensible defaults (`settings.service.ts`).
- **Direct order flow** (bypasses the cart entirely): new
  `checkoutService.createDirectOrder(event, input)` in
  `server/services/checkout.service.ts` — validates the product is `active`
  + `layoutStyle === 'landing'`, validates the variant belongs to it and has
  enough stock, calculates shipping via the existing
  `shippingService.calculateFee`, decrements stock via the existing
  `inventoryService.adjustStock` (with the same rollback-on-failure pattern
  as `createOrder`), creates the order via the existing `ordersRepository`,
  and returns the same shape as cart checkout so
  `/order-confirmation/:id` needs no changes. Schema:
  `server/schemas/direct-order.schema.ts`. Route:
  `POST /api/checkout/direct` (public, no auth required — same as
  `/api/checkout`).
- **Admin UI**:
  - `/admin/products/:id` gained a "Landing page" card: a layout-style
    select, a benefits repeater (icon + text, max 6), and a lifestyle-block
    repeater (image upload + caption, max 3). Lifestyle images upload via a
    new `POST /api/admin/products/:id/landing-images` route (same
    `uploadImageToR2` pattern as the regular gallery, but folder
    `products/:id/landing` and **not** stored in `product_images` — the URL
    is stored directly in the `landingBlocks` JSON field instead, like hero
    images in store settings).
  - `/admin/settings` gained a "Trust badges" card (icon + label repeater,
    max 6).
  - `/admin/products` list shows a "Landing" badge next to the product name.
- **Storefront**: `app/pages/products/[slug].vue` branches on
  `product.layoutStyle` — `standard` renders the original template
  unchanged; `landing` renders the new `app/components/ProductLandingPage.vue`
  instead. The variant-selection logic (attribute grouping, in-stock default
  selection, price/stock derivation) used to live inline in `[slug].vue`; it
  was extracted verbatim into `app/composables/useProductVariants.ts` so both
  templates share identical behavior — if you touch variant-selection logic,
  edit the composable, not either page/component.
  `ProductLandingPage.vue` has no related-products section and no live
  shipping quote in its form (intentional — it shows a generic "fees
  confirmed on review" note instead, per product decision), but is otherwise
  gallery → price/variants/quantity → embedded order form → sticky bottom
  CTA bar (`IntersectionObserver` on the order card) → benefits → lifestyle
  blocks → trust badges.
- Verified end-to-end via curl: switched a real product (Wool Coat 3) to
  `landing` with benefits/blocks, confirmed the public API and rendered page
  show the new template and no "Add to cart" button, placed a direct order
  (stock decremented, order visible in `/admin/orders`, confirmation page
  renders), confirmed guard rails (`422` on a `standard` product, `409` on
  quantity exceeding stock, `422` validation on missing fields). Unit tests:
  `tests/unit/direct-order.test.ts`.

### Currency switch to MAD + real product import (gap, not a numbered phase) — ✅ done
The store's first real (non-demo) products were imported from two existing
single-product COD landing sites the owner runs on hodhodshop.com
(`alma.hodhodshop.com`, `elise.hodhodshop.com`), fetched and re-hosted
directly rather than hand-entered.

- **Currency**: switched store-wide from USD to MAD (Moroccan Dirham),
  displayed with the colloquial "DH" suffix (`599 DH`), not `$` or the ISO
  `MAD` code. Added `app/utils/currency.ts` exporting `formatPrice(cents)`
  — a single shared helper that replaced 16 duplicated inline
  `toLocaleString(..., { style: 'currency', currency: 'USD' })` functions
  across storefront + admin pages/components. `orders.currency` is now
  hardcoded `'MAD'` on creation (`checkout.service.ts` / `orders.repository.ts`).
  If a future store needs multi-currency or a different display format,
  start from this one util, not by re-duplicating inline formatters.
- **Trust badges + Landing template → French**: the store-wide
  `trustBadges` default and all fixed/chrome text in
  `ProductLandingPage.vue` (form labels, CTA button, section headers,
  sticky bar, toast messages) were translated to French. This is global —
  **any future Landing-style product will show French chrome text**, even
  if its own content is in English, since there's no i18n layer in this
  project. If an English-language Landing product is ever added, this
  component's hardcoded strings need to be revisited (either translated
  back, or a proper i18n solution introduced).
- **Imported two real products** (both `layoutStyle: 'landing'`):
  "Manteau Alma — Brun Chocolat" (599 DH, sizes S/M/L) and "Manteau Élise —
  Bleu Marine" (349 DH, sizes S/M/L modeled as 0-stock/unavailable plus
  XL/XXL in stock, matching the source site). New "Taille" (select) and
  "Couleur" (swatch) attributes and a "Manteaux" category were created.
  All gallery and lifestyle-block images were downloaded from the source
  sites and re-uploaded through the normal admin upload endpoints into this
  store's own R2 bucket — nothing hotlinks hodhodshop.com.
- A one-off import script (not part of the repo — it was a scripted series
  of admin API calls, run once against local dev to verify, then once
  against production) created the attributes, category, products,
  variants, and images, then set the French `trustBadges`. If more
  hodhodshop-style products ever need importing, recreate the same style of
  script rather than hand-clicking through the admin UI.
- **Found and fixed a real, pre-existing production bug while verifying
  this**: every public page that loaded data via
  `useAsyncData(() => $fetch(...))` (homepage, `/categories`,
  `/category/:slug`, `/products` sidebar, `/products/:slug`, the global
  `StorefrontHeader` store name, and `ProductLandingPage`'s trust badges)
  silently returned empty/null data during server-side rendering
  specifically on the **deployed Cloudflare Worker** — plain `$fetch` to a
  relative URL does not resolve the same way there as it does under local
  dev's Miniflare emulation, so this had been invisible all along (local
  `pnpm dev` always looked correct). The affected pages rendered as
  near-empty / "not found" on first paint in production, only "fixing
  themselves" after client-side hydration re-fetched. Fixed by switching
  every one of those `useAsyncData` fetchers from `$fetch` to the existing
  `apiFetch()` composable (`app/composables/useApi.ts`), which uses
  `useRequestFetch()` during SSR — proven working in production already via
  `order-confirmation/[id].vue`. **Any new page added that needs SSR data
  must use `apiFetch`, never bare `$fetch`, for this reason** — `$fetch` is
  still fine for client-only interactive calls (form submits, button
  clicks), just not for anything awaited at the top of `<script setup>`.
  Verified via curl directly against the live production URL, both before
  (broken) and after (fixed) this change.

### Storefront i18n: French/English/Arabic + RTL (gap, not a numbered phase) — ✅ done
Full internationalization of the **storefront only** (explicit scope decision
— the admin dashboard at `/admin/*` stays English-only, same convention as
the earlier "Atelier Admin" branding decision). Covers UI chrome (buttons,
labels, nav, form fields, toasts, empty states) — **not** product/category
content itself, which stays single-language as entered by the admin,
regardless of the selected site language (also an explicit decision; the
database has no translation columns/table for product content).

- **Module**: `@nuxtjs/i18n` v10, configured in `nuxt.config.ts` with
  `strategy: 'no_prefix'` (URLs never change, e.g. `/products/foo` is the
  same URL in all three languages) and `detectBrowserLanguage: false`.
  Message files live at `i18n/locales/{fr,en,ar}.json` — note this is
  `<rootDir>/i18n/locales/`, **not** `app/locales/`; the module's default
  `restructureDir` convention looks there regardless of `langDir`, and
  putting them under `app/` causes a build-time ENOENT.
- **Default language is always French, never auto-detected**: the module's
  own `detectBrowserLanguage` (which reads `navigator.language`/
  `Accept-Language`) is deliberately disabled. Instead, `app/plugins/
  locale.ts` manages a single cookie (`store_locale`) that is *only* ever
  written when a visitor explicitly picks a language via the switcher — so
  a first-time visitor always sees French, and a returning visitor who
  switched before sees their explicit choice, with no browser-based
  detection involved at any point. That plugin uses `nuxtApp.$i18n`
  rather than the `useI18n()` composable, because `useI18n()` requires an
  active Vue component `setup()` context, which a plain Nuxt plugin is not
  (this threw `Must be called at the top of a setup function` until fixed).
- **Language switcher**: `app/components/LanguageSwitcher.vue`, a small
  `USelect` in `StorefrontHeader.vue` next to the cart icon. Labels are
  translated into whatever the *current* UI language is (e.g. shows
  "Français/Anglais/Arabe" when French is active, "Français/English/Arabic"
  when English is active, etc.) via `language.fr`/`language.en`/`language.ar`
  keys in each locale file.
  - Admin deliberately has no switcher and is unaffected by the cookie even
    if a customer picked Arabic on the storefront moments earlier — see below.
- **RTL for Arabic**: each locale in `nuxt.config.ts` declares a `dir`
  (`'ltr'` for fr/en, `'rtl'` for ar). `app/app.vue` computes `<html lang>`
  and `<html dir>` reactively from the current locale and sets them via
  `useHead` — this lives in `app.vue` (not a layout) specifically so it
  also covers layout-less pages like `/admin/login` (`definePageMeta({
  layout: false })`), which a per-layout `useHead` call would miss.
  **Admin pages always force `lang="en" dir="ltr"`** regardless of the
  storefront's selected locale — checked by `route.path.startsWith('/admin')`
  in `app.vue`, not by locale, precisely so switching to Arabic on the
  storefront never visually flips the admin dashboard.
  - All storefront Tailwind classes using physical direction utilities
    (`pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`/`text-left`/`text-right`) were
    converted to logical equivalents (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`/
    `text-start`) so spacing and positioning actually mirror under
    `dir="rtl"`. Admin pages were left on physical classes since admin is
    always LTR — **if admin is ever given RTL support later, those classes
    need the same conversion.**
- **This also fixed a previously-flagged bug**: `ProductLandingPage.vue`'s
  chrome text (used by both imported hodhodshop products) was hardcoded to
  French regardless of the rest of the store's language, flagged in the
  prior section as *"if an English-language Landing product is ever added,
  this component's hardcoded strings need to be revisited."* It's now fully
  translated like every other storefront component, so it correctly follows
  whatever language the visitor has selected.
- Locale JSON files are verified to have **identical key sets** across all
  three languages (checked via a one-off Node script comparing sorted key
  paths — no copy-paste typos or missing translations). If more UI strings
  are added later, keep all three files in sync the same way; a mismatch
  silently falls back to the key path as literal text instead of erroring.
- Verified end-to-end via curl against both local dev and production: French
  default on first visit (no cookie), explicit switch to English/Arabic via
  cookie persists across pages, `<html lang>`/`<html dir>` flip correctly
  including on the Arabic-RTL imported Landing product pages, a full
  add-to-cart → checkout flow renders translated form labels in all three
  languages, and `/admin/login` plus the post-login admin dashboard stay
  `lang="en" dir="ltr"` even with an `ar` locale cookie set.

### Real web fonts for fr/en + Arabic pairing (gap, not a numbered phase) — ✅ done
`SPEC.md` named Fraunces (display) + Inter (body) as the intended typefaces,
but they were **never actually loaded** — `main.css` only referenced them by
name with system fallbacks (`ui-serif, Georgia`/`ui-sans-serif, system-ui`),
so every visitor had always been seeing Georgia/system-ui, not the intended
fonts, the whole time. Also, system fonts render Arabic inconsistently
across OSes/browsers with no real design intent behind them.

- Added `@nuxt/fonts`, which downloads and self-hosts Google Fonts at build
  time (no runtime calls to Google from the Cloudflare Worker — good for
  both performance and not depending on an external network call on every
  request). Explicitly configured in `nuxt.config.ts` under `fonts.families`
  with `global: true` for all four families (safer than relying on the
  module's static CSS-usage scan, since our font names are referenced only
  through custom properties, not literal `font-family: 'X'` declarations).
- **French/English**: Fraunces (headings, weights 400–700 + italics) and
  Inter (body, weights 400–700) — now actually load, matching `SPEC.md`.
- **Arabic pairing**: since Fraunces/Inter have no meaningful Arabic glyph
  coverage, Arabic gets its own pair — **El Messiri** (headings) and
  **Cairo** (body), both with the `arabic` Google Fonts subset. Chosen to
  echo the Latin pairing's personality (El Messiri is a characterful
  display face like Fraunces; Cairo is a clean neutral UI face like Inter),
  not arbitrary picks.
- Wired up in `app/assets/css/main.css` as `--font-display-ar`/
  `--font-sans-ar` theme tokens, applied only under `html[lang="ar"]`
  (scoped by attribute selector, so it activates/deactivates automatically
  as the existing locale machinery flips `<html lang>` — see the i18n
  section above). Admin is always `lang="en"` so it never receives the
  Arabic fonts. Latin display tracking (`letter-spacing: -0.01em`) is reset
  to `normal` for Arabic headings specifically, since negative tracking can
  interfere with Arabic letterform joining.
- Verified via build output: all four families produce real `@font-face`
  rules with self-hosted `.woff2` files under `/_nuxt/fonts/` (not a Google
  Fonts CDN link), and the `html[lang="ar"]` override rule is present in the
  shipped CSS — checked in both local dev and the live production build,
  including a direct fetch of one of the hashed font URLs returning
  `content-type: font/woff2` with real byte content.

### AI features: OpenRouter integration, catalog translation, AI product wizard (gap, not a numbered phase) — ✅ done
Added full AI capabilities via **OpenRouter** (one provider/API key for text,
vision, and image generation — video generation is documented by OpenRouter
too but intentionally not wired up yet, see below). This shipped two
connected features: store-wide catalog translation, and an AI product
creation wizard.

**OpenRouter client** (`server/utils/openrouter.ts`): a thin wrapper, no SDK.
- Text/vision: `google/gemini-2.5-flash` via `/chat/completions`, with
  `response_format: { type: 'json_object' }` and a strict prompt describing
  the exact JSON shape — used for both product-copy generation (reads the
  reference photo) and translation (pure text).
- Images: `google/gemini-2.5-flash-image` via the dedicated `/images`
  endpoint, using `input_references` for image-to-image generation — this is
  what keeps "same garment, new angle" shots actually consistent with the
  source photo instead of generating a lookalike. The model caps `n` at 1, so
  generating N carousel shots means N sequential calls, each with its own
  angle/setting prompt (front, back, detail, lifestyle).
- Video: deliberately not implemented. OpenRouter's video API is a separate
  async submit-then-poll job pattern (`/videos` + polling), a bigger feature
  on its own — left out of scope for this round, nothing blocks adding it
  later behind the same client file.
- Secret: `OPENROUTER_API_KEY`, a `.dev.vars` entry locally and a
  `wrangler secret put` in production — read via the same
  `event.context.cloudflare.env.X` pattern as every other binding in this
  codebase, never exposed to the client.

**Catalog translation (store-wide, not just AI-wizard products).** Product
and category content was previously single-language (admin's input
language, shown to everyone regardless of selected UI locale — a deliberate
earlier decision). That changed: French now stays the base/source-of-truth
content (the existing `products`/`categories` columns, unchanged), and two
new tables hold English/Arabic *overrides*:
- `product_translations` (productId, locale ∈ {en, ar}): name,
  shortDescription, description, seoTitle, seoDescription, plus translated
  landing-page benefit bullets and lifestyle captions (captions are aligned
  by array index to the product's own `landingBlocks`, since images
  themselves aren't translated).
- `category_translations` (categoryId, locale ∈ {en, ar}): name,
  description.
- Every field is nullable and resolved **field-by-field** with fallback to
  French (`server/utils/locale.ts`'s `applyProductTranslation` /
  `applyCategoryTranslation`) — a half-translated product never shows blank
  text for the untranslated fields.
- The storefront resolves locale server-side by reading the same
  `store_locale` cookie the language switcher already writes (see the i18n
  section above) — no new plumbing, `getCookie(event, 'store_locale')`
  inside `storefrontCatalog.service.ts` / `storefrontCategories.service.ts`,
  defaulting to French with no browser detection, consistent with the rest
  of the i18n system. Verified live: switching to English shows the saved
  translation; switching to Arabic with no Arabic translation yet falls back
  to French automatically, not blank.
- Admin UI: the product edit page and the category editor both gained
  English/Arabic tabs with a **"Translate from French"** button (calls
  OpenRouter, fills the tab, still fully editable) plus their own explicit
  save action — translations are a separate table/endpoint from the main
  product/category save. Both the products list and categories list also
  got a **"Translate all (AI)"** bulk action that loops through every
  row client-side (not a single giant server-side loop, to stay well clear
  of Worker execution-time limits), showing live progress and a total cost
  — this is what backfills the existing catalog (Alma/Élise, etc.) in one
  click; re-running it later overwrites existing translations, which is
  the intended behavior for a deliberate bulk action.
- Order line items still snapshot the base/French product name at checkout
  (unchanged) — locale-aware order history was considered but cut to keep
  scope bounded; this only affects internal order records, not anything
  customer-facing on the storefront.

**AI product creation wizard** (`/admin/products/new-ai`), a new path
alongside (not replacing) manual product creation:
1. **Input**: upload one reference photo (converted to a base64 data URL
   client-side, never touches R2 until the final confirm step); pick
   colors/sizes from the store's *existing* attribute system (matching is
   locale-aware — this store's attributes are named "Couleur"/"Taille" in
   French, which the wizard matches alongside the English names); a stock
   grid, one number per color×size combination; price; compare-at price;
   categories.
2. **Generate**: one call writes French name/short+long description/SEO from
   the photo, immediately followed by French→English and French→Arabic
   translation of that same copy, so the review step opens with all three
   languages already populated. A second call generates the requested number
   (1–4) of additional carousel photos, each depicting the literal same
   garment from a different angle/setting (front, back, detail, lifestyle).
3. **Review**: every language tab and every photo is fully editable before
   anything is persisted; any single generated photo can be regenerated
   (re-runs just that one shot) or removed; the reference photo can be
   excluded from the final product too; running AI cost is shown (OpenRouter
   returns real USD cost per call in its response).
4. **Confirm**: only then does `POST /api/admin/ai/products`
   (`server/services/ai.service.ts`) actually create the product — reusing
   `productsService.create`/`variantsRepository`/`uploadImageToR2` under the
   hood, no parallel data path. The product's auto-seeded "default" variant
   (every product gets one on creation, see `productsService.create`) is
   deleted and replaced by the wizard's real color×size variants to avoid
   any SKU collision risk.
- Verified with real OpenRouter calls end-to-end locally and in production:
  vision-based copy generation, translation, image-to-image generation
  (visually confirmed the generated photo preserves the exact garment —
  same buttons/pockets/collar/color/pattern — in a new clean studio angle),
  and full product creation with 2 variants + 2 images + en/ar translations
  landing correctly, then cleaned up.
- Guardrails: nothing is ever auto-saved — every AI step is a distinct,
  reviewable, re-runnable action; image count is capped at 4 per generation;
  all AI endpoints are admin-only (`requireAdmin`) and validated (zod).

### Phase 11: Testing, security review, deployment
- Optionally expand test coverage further
- Security pass: re-verify every admin route has `requireAdmin`, review
  cookie flags, consider basic rate-limiting on `/api/auth/login` and
  `/api/auth/register` (currently none — brute-force is possible), confirm
  no sensitive fields (password hashes, other customers' data) ever appear
  in API responses
- Real Cloudflare deployment (see `docs/DEPLOYMENT.md`, already written in
  Phase 1): `wrangler login`, create real D1/R2/KV resources, update

  `wrangler.jsonc` placeholders with real IDs, `pnpm db:migrate:remote`,
  connect Cloudflare Workers Builds to the GitHub repo for auto-deploy. This
  needs the user's Cloudflare account — not yet done, `wrangler whoami`
  showed not logged in as of Phase 1 and hasn't been revisited since.

---

## Files to read first in a fresh session

1. `SPEC.md` — full requirements/spec, source of truth for scope
2. This file
3. `git log --oneline --reverse` — phase-by-phase commit history
4. `server/database/schema/index.ts` and its siblings — full data model
5. `docs/DEPLOYMENT.md` — Cloudflare setup steps when ready to deploy
