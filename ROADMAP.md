# Roadmap — Next Phases

This is a **forward-looking plan**, not a record of what's done (that's
`AI_BUILD_PROGRESS.md`) and not the original requirements (that's
`SPEC.md`). Read this alongside both before starting any phase below — it
assumes everything in `AI_BUILD_PROGRESS.md` is already built (OpenRouter
integration, AI product wizard, catalog translation, Marketing section with
social post generator, AI model config in Settings, etc.).

Each phase below is scoped to be independently shippable: implement, verify
(local dev + a real build), commit, push, and deploy before moving to the
next one — same working style as every phase before it. Update this file's
status table as phases complete, same convention as `AI_BUILD_PROGRESS.md`.

**Why these phases exist**: this store was built so its owner's wife can run
it entirely on her own, without pulling in a developer for every landing
page, ad, or piece of content. These phases continue that goal: knowing who
actually buys (even without accounts), converting more of the traffic
already arriving, and generating more of the ad/content work by herself.

---

## Status

| Phase | Status |
|---|---|
| A. Customer identity rework (phone-based, account-free) | ✅ Done |
| B. "Confirm via WhatsApp" button | ✅ Done |
| C. Homepage richness (bestsellers + trust badges) | ❌ Not started |
| D. Upsell / cross-sell (rule-based) | ❌ Not started |
| E. Reviews & ratings (admin-entered) | ❌ Not started |
| F. AI ad-copy generator (Meta/TikTok) | ❌ Not started |
| G. Video ad generator | ❌ Not started |

Suggested order is the order listed (A and B are foundational/cheap; C is
nearly free given existing infra; D/E are the core conversion work; F/G are
new AI surface area, G being the biggest lift — do it last).

---

## Open decisions — confirmed by user

1. **Phase D**: Landing-page companions **do** get full multi-item support —
   `createDirectOrder` is extended to accept a second line item (the
   companion), not just a link-out. The companion is a fixed-quantity-1
   add-on (its own default/first-active variant), not a full quantity
   selector.
2. **Phase D**: quantity-break discounts (buy X, save Y%) **are** in scope,
   configurable **per-product** (an optional rule set on each product's edit
   page), applied on both classic cart lines and the direct-order quantity
   selector.
3. **Phase E**: reviews are shown as entered, **not** auto-translated
   per-locale like product content is.
4. **Phase D**: the cart free-shipping progress bar is driven by one new
   global `defaultFreeShippingThreshold` setting (display-only — the real
   fee is still computed correctly per-city at checkout via
   `shippingService.calculateFee`). This can visually disagree with a
   specific city's actual zone threshold; accepted tradeoff since the real
   city isn't known until the address step.

---

## Phase A — Customer identity rework (phone-based, account-free)

**Problem**: `customer_profiles` currently requires a `users` row
(`userId` is `NOT NULL`). Since customer accounts are deliberately deferred
and there's no storefront registration UI, **no guest order ever creates a
customer_profiles row** — the admin Customers page (`/admin/customers`) is
always empty today, regardless of real order volume.

**Goal**: every order — guest or (later) logged-in — creates or updates a
customer record identified primarily by **phone number** (the real COD
identity key in Morocco), so the Customers admin section actually reflects
real buyers and their order history. This also lays groundwork for any
future monetization of customer data (repeat-customer lists, retargeting,
etc.) — no new scope for that now, just clean identity as the prerequisite.

### Schema changes
- `customer_profiles` (migration, drizzle-kit will likely regenerate the
  table the same way migration `0003` did for `products`):
  - `user_id`: drop `NOT NULL` (keep nullable + unique — SQLite unique
    indexes allow multiple NULLs, so this is safe). Kept only so a future
    customer-login feature can link to this same record instead of
    duplicating it.
  - Add `phone` (text, `NOT NULL`, **unique index**) — canonical identity
    key, normalized (see below).
  - Add `full_name` (text, `NOT NULL`) — latest known name.
  - Add `email` (text, nullable) — latest known email.
  - Keep `notes`, `created_at`, `updated_at`.
- No changes to `orders` (`customerProfileId` already exists and is
  already indexed; `orders.customer_phone` stays as the per-order
  snapshot, independent of the customer record).

### New utility
- `server/utils/phone.ts` — `normalizePhoneMA(raw: string): string`.
  Canonicalizes Moroccan numbers to local `0XXXXXXXXX` format (10 digits),
  handling `+212`, `00212`, bare `212`, spaces/dashes/parens. Falls back to
  a best-effort trimmed/cleaned string for anything that doesn't match a
  recognizable Moroccan pattern — **never throws, never drops data**.
  Also export a variant producing the international-digits form (no `+`,
  e.g. `212612345678`) for Phase B's `wa.me` links.

### Repository/service changes
- `server/repositories/customers.repository.ts`: drop the inner join
  through `users` — read `full_name`/`email`/`phone` directly from
  `customer_profiles`. Add a `findOrCreateByPhone(event, { phone, fullName,
  email })`: normalizes phone, looks up by normalized phone; if found,
  updates `fullName`/`email` when non-empty ("latest wins") and touches
  `updatedAt`; if not found, inserts a new profile. Keep a left join to
  `users` only to expose a cheap `hasAccount: boolean` (nice-to-have badge
  in the admin UI), not as a requirement for the row to exist.
- `server/utils/customer.ts`: `resolveCustomerProfileId(event, input: {
  phone, fullName, email })` — if a session user is logged in, resolve
  their existing profile (unchanged, future-proofing for when accounts
  ship); otherwise call `findOrCreateByPhone`. Replaces the current no-arg
  guest-only version (which always returned `null`).
- `server/services/checkout.service.ts`: both `createOrder` and
  `createDirectOrder` call the new `resolveCustomerProfileId(event, {
  phone: input.phone, fullName: input.fullName, email: input.email })`.

### One-time (but safely re-runnable) backfill
- `customersService.backfillFromOrders(event)`: finds every order with
  `customerProfileId IS NULL`, groups by normalized phone, find-or-creates
  a profile per group (name/email taken from that group's most recent
  order), and updates those orders' `customerProfileId`. Idempotent — safe
  to run more than once.
- Expose as `POST /api/admin/customers/backfill` plus a button in the
  Customers admin page's empty state ("No customers yet — backfill from
  existing orders"), kept as a permanent (not throwaway) admin action.
- Run it once for real against production data after deploying this phase,
  so existing order history retroactively becomes customer records.

### Admin UI
- `/admin/customers` and `/admin/customers/[id]`: minimal changes, same
  field shape (`fullName`, `email`, `phone`, `createdAt`, `totalOrders`,
  `totalSpent`). Add a small "Guest" vs "Has account" badge using the new
  `hasAccount` flag.

### Verification checklist
- Place a guest checkout order (cart + direct-order both), confirm a
  customer_profiles row appears with the right phone/name/email.
- Place a second order with the same phone but a slightly different phone
  format (e.g. `+212 6 12 34 56 78` vs `0612345678`) — confirm it attaches
  to the **same** customer, not a duplicate.
- Run the backfill against existing dev data, confirm order counts/totals
  match reality.
- Confirm admin login/session (unrelated `users` table) is completely
  unaffected.

---

## Phase B — "Confirm via WhatsApp" button

**Goal**: reduce the manual retyping involved in confirming a COD order —
one tap pre-fills a WhatsApp message instead of typing the order out from
scratch.

- Deterministic **French** message template (order number, items +
  quantities, total, city/address) — **not AI-generated**, since a
  confirmation message must be factually exact every single time, not
  re-generated with any risk of drift/hallucination.
- Button on `/admin/orders/[id]`: builds `https://wa.me/<international
  digits>?text=<url-encoded message>` using the Phase A phone normalizer,
  opens in a new tab. No new backend endpoint needed — this can be a pure
  client-side computed URL from data already on the order-detail page.

### Verification checklist
- Button produces a valid `wa.me` link with correctly encoded line breaks
  and the exact order total/items for a real test order.
- Confirm it works for an order placed before this phone-normalization
  logic existed (i.e. handles whatever raw format is already stored in
  `orders.customer_phone`).

---

## Phase C — Homepage richness

Mostly reuses existing infrastructure — low effort, no new tables.

- **Bestsellers rail**: the storefront catalog service already supports
  `sort: 'popularity'` (units sold via `order_items`, already used by the
  `/products` and `/category/:slug` sort dropdowns) — just not used on the
  homepage yet. Add a new homepage section mirroring the existing "New
  arrivals" section, fetching `/api/products?sort=popularity&pageSize=8`.
- **Trust badges bar**: `settings.trustBadges` already exists and already
  renders on Landing-style product pages, but never on the homepage. Add
  the same section (icon + label grid) to `app/pages/index.vue`, reusing
  the already-fetched `settings` data — no new fetch needed.
- (Deferred to right after Phase E ships, not part of this phase: a small
  homepage "customer love" strip pulling 2-3 recent high-rated reviews,
  once reviews exist.)

### Verification checklist
- Homepage shows a real bestsellers rail reflecting actual order history
  (verify against a product you know has the most units sold in test
  data).
- Trust badges render identically in style to the Landing-page version,
  in all three locales.

---

## Phase D — Upsell / cross-sell (rule-based)

### Schema
- New table `product_upsells`: `id`, `productId` (FK, `onDelete: cascade`),
  `relatedProductId` (FK, `onDelete: cascade` — the mapping row itself
  should disappear if either product is deleted, not dangle with a null),
  `position` (integer, for ordering), `createdAt`. Unique index on
  `(productId, relatedProductId)`.

### Admin UI
- `/admin/products/[id]`: new "Frequently bought together" section — reuse
  the existing product-search pattern (same debounced search UX as the
  social post generator's product picker) to add companion products,
  drag/reorder or simple up/down, remove.

### Storefront
- **Classic product pages** (real cart): new section "Frequently bought
  together", distinct from the existing category-based "You may also
  like" (`product.related`). Each companion gets its own "Add to cart"
  (using its default/first-active variant) plus one "Add all to cart"
  button for the whole set.
- **Landing-style product pages**: companions shown as simple "You might
  also like" cards linking to their own page — **not** injected into the
  single-item direct-order form (see open decision #1 above).
- **Cart page** (`app/pages/cart.vue`): free-shipping progress bar — "You're
  X DH away from free shipping" / "Free shipping unlocked!" — driven by a
  new store-wide setting, see below. Purely informational; real fee
  calculation at checkout is untouched.

### Settings addition
- New `store_settings` field `defaultFreeShippingThreshold` (nullable
  integer, cents), added next to the existing `defaultShippingFee` in
  Settings → Shipping default. If unset, the cart progress bar is hidden
  entirely.

### Verification checklist
- Admin can add/reorder/remove companions for a product; duplicates
  rejected.
- Classic product page: individual add + "add all" both correctly add the
  right variants/quantities to the cart.
- Landing page: companions link out correctly, order form itself
  unchanged.
- Cart bar: shows progressing/unlocked states correctly as items are
  added/removed; hidden when the setting is unset.

---

## Phase E — Reviews & ratings (admin-entered)

### Schema
- New table `reviews`: `id`, `productId` (FK, `onDelete: cascade`),
  `customerProfileId` (FK, nullable, `onDelete: set null` — optional link
  to a known customer from Phase A, not required), `customerName` (text,
  free entry), `rating` (integer 1-5), `title` (nullable), `body` (text),
  `photoUrl` (nullable, via the existing `uploadImageToR2` pattern),
  `isVisible` (boolean, default true), `createdAt`, `updatedAt`.

### Admin UI
- `/admin/products/[id]`: new "Reviews" section — list existing reviews
  (with visible/hidden toggle + delete) and an "Add review" form (customer
  name, star rating, title, body, optional photo upload).
- **AI polish helper**: a "Clean up with AI" button next to the body
  field — paste raw feedback (e.g. a WhatsApp message), AI drafts a
  cleaned-up `{ title, body }` suggestion the admin reviews/edits before
  saving (never auto-saves, same pattern as every other AI feature in this
  app). New `aiService.polishReview(event, { rawText, productName })`
  reusing the existing `chatJson` helper in `openrouter.ts`.

### Public API / storefront
- Extend `storefrontCatalog.service.ts`'s `list()` and `get()` to include
  a lightweight `rating: { average, count }` per product (only counting
  `isVisible` reviews).
- Product pages (classic + landing): star rating + review count near the
  price, full review list (name, stars, date, body, photo if present)
  below description/benefits.
- Product cards (`ProductGrid`/listing + the new bestsellers/featured
  rails from Phase C): small rating badge.

### Verification checklist
- Add/edit/hide/delete a review from the admin; confirm hidden reviews
  never appear in the public API or storefront.
- Average rating recalculates correctly as reviews are added/hidden.
- AI polish produces a sensible draft from a messy pasted paragraph, never
  auto-saves without an explicit confirm.

---

## Phase F — AI ad-copy generator (Meta/TikTok)

Same shape as the existing social post generator
(`server/services/marketing.service.ts`'s `SOCIAL_POST_PROMPT_TYPES` +
`generateSocialPost`), reused rather than duplicated where possible.

### Backend
- `openrouter.ts`: new `generateAdCopy(event, params)` — system prompt
  varies by platform:
  - **Meta**: returns `{ headlines: string[] (5), primaryTexts: string[]
    (3-5), descriptions: string[] (2) }` — matches Meta Ads Manager's
    dynamic-creative composer fields so output can be pasted directly.
  - **TikTok**: returns `{ primaryTexts: string[] (3-5) }` — TikTok ad
    copy is simpler, closer to organic caption style but with a clear CTA.
  - Reuses `SOCIAL_POST_PROMPT_TYPES` (same categorized angle picker) and
    the same optional `extraNotes` free-text field.
- New table `ad_copy_sets` (mirrors `social_posts`): `id`, `productId`
  (nullable, `onDelete: set null`), `productName`, `imageUrl`, `platform`,
  `locale`, `promptTypeId`, `promptTypeLabel`, `extraNotes`, `headlines`
  (json), `primaryTexts` (json), `descriptions` (json, nullable), `cost`,
  `createdAt`.
- `marketingService.generateAdCopy` / `listSavedAdCopy` /
  `deleteSavedAdCopy` — same save-automatically + delete pattern as social
  posts.
- Routes: `POST /api/admin/marketing/ad-copy/generate`, `GET`/`DELETE
  /api/admin/marketing/ad-copy[/:id]`.

### Admin UI
- New page `/admin/marketing/ad-copy`, mirroring
  `app/pages/admin/marketing/social-posts.vue`'s UX: product search,
  prompt-angle picker, platform toggle (Meta/TikTok), language, extra
  notes, generate, saved history with copy-per-field buttons + delete.
- Nav entry under Marketing in `AdminNavLinks.vue`.

### Verification checklist
- Generate for both platforms, confirm output field shapes match what
  each platform's ad composer actually expects.
- Saved history persists and deletes correctly, same as social posts.

---

## Phase G — Video ad generator

Biggest lift — new async-job architecture, real per-clip cost. Build last,
after everything above has shipped.

### Confirmed via OpenRouter's docs (researched during planning)
- Real async Video Generation API: `POST /api/v1/videos` → `{ id,
  polling_url, status }` → `GET /api/v1/videos/{jobId}` to poll → `GET
  /api/v1/videos/{jobId}/content` to download (or use the `urls`/
  `unsigned_urls` in the completed response).
- **Image-to-video via `frame_images`**: supply the existing AI-generated
  product photo as `{ type: 'image_url', image_url: { url }, frame_type:
  'first_frame' }` — this is the correct param for "animate this exact
  photo" (as opposed to `input_references`, which is for looser style/
  character guidance, not a literal starting frame).
- Models: `google/veo-3.1` (durations 4/6/8s, up to 4K, 16:9/9:16,
  optional audio), plus Sora 2 Pro / Seedance / Wan also available.
- Pricing is per-second via `pricing_skus` (e.g. Veo 3.1: ~$0.40/s with
  audio at 720p, ~$0.20/s without — so a 6s silent clip ≈ $1.20, with
  audio ≈ $2.40). Fetch `GET /api/v1/videos/models` for live, accurate
  numbers per model/resolution/audio combination.
- **No Cron/Queues/webhook needed for v1**: since this is an
  admin-initiated, admin-waiting action, the admin page itself polls our
  own backend status endpoint (which re-checks OpenRouter) every ~10s
  while open. The status endpoint is stateless/idempotent — reopening the
  page later for a still-pending job just re-polls and catches up, so
  there's no need for background infrastructure in v1. (A `callback_url`
  webhook is a documented, natural v1.1 upgrade if "start and walk away"
  becomes important later.)
- Video generation is **not** eligible for Zero Data Retention — not
  relevant here since this account doesn't use ZDR, just noting it in
  case that ever changes.

### Schema
- New table `video_jobs`: `id`, `productId` (nullable, `onDelete: set
  null`), `productName`, `sourceImageUrl` (the chosen existing product
  photo), `motionPresetId`, `motionInstruction`, `extraNotes`, `duration`,
  `resolution`, `aspectRatio`, `generateAudio` (boolean), `status`
  (`pending`/`in_progress`/`completed`/`failed`), `openrouterJobId`,
  `videoUrl` (R2 `/media/...` url once completed), `cost`,
  `errorMessage`, `createdAt`, `updatedAt`.

### New utilities
- `server/utils/openrouterVideo.ts`: `submitVideoJob`, `pollVideoJob`,
  `downloadVideoContent` — mirrors the style of `openrouter.ts` but for
  the `/videos` endpoints (separate file since the shape — async jobs vs.
  synchronous chat/image calls — is different enough to not force into
  the same file).
- `server/utils/openrouterVideoModels.ts`: fetches `/api/v1/videos/models`
  for the Settings picker, same curated-catalog pattern as
  `openrouterModels.ts`.
- `media.ts`: add `uploadVideoToR2` (parallel to `uploadImageToR2`, allows
  `video/mp4`, separate from the image-only allowlist already there).

### Motion preset library
- Curated list (8-10 entries, same pattern as `IMAGE_SCENES` /
  `SOCIAL_POST_PROMPT_TYPES`) since writing a good video-motion prompt
  isn't obvious to a non-technical admin: "Slow 360° turntable", "Camera
  slowly pushes in", "Model turns and walks toward camera", "Fabric sways
  gently in a breeze", "Product rotates on a pedestal", "Close-up pan
  across fabric texture", etc. Plus an optional free-text "extra details"
  field, same as social posts/ad copy.

### Settings addition
- Settings → AI generation gains a **video model** picker (alongside the
  existing text/image pickers), same live-OpenRouter-catalog pattern.
  Config key in `aiConfig.service.ts` (`ai_config_video_model`).

### Admin UI
- New page `/admin/marketing/video-ads`:
  1. Pick a product (same search pattern as elsewhere), pick one of its
     existing photos as the starting frame.
  2. Pick a motion preset (+ optional extra notes).
  3. Choose duration / resolution / audio on/off.
  4. **See the estimated cost (computed from live pricing) and explicitly
     confirm** before submitting — per the user's explicit instruction,
     this is a harder requirement here than for photos given the much
     higher per-generation cost.
  5. Submits the job, shows a "generating…" status, polls automatically
     while the page is open (and on-demand via a manual "Check status"
     button) until complete.
  6. Saved history list below: video playback, download, delete (delete
     also removes the R2 object).
- Nav entry under Marketing.

### Verification checklist
- Submit a real job end-to-end (small/cheap duration+resolution first),
  confirm it reaches `completed` and the clip downloads into R2 correctly
  and plays back.
- Confirm the estimated cost shown before submit matches the actual
  `usage.cost` returned once the job completes (sanity check, not
  necessarily exact given provider-side variability).
- Confirm a `failed` job surfaces its `error` message usefully in the
  admin UI instead of hanging.
- Confirm deleting a saved video also removes the underlying R2 object
  (no orphaned storage).

---

## Files to read first when starting any of these phases

1. `SPEC.md` — original requirements/spec
2. `AI_BUILD_PROGRESS.md` — what's actually built, architectural
   conventions (server layering, API envelope, auth helpers, money as
   cents, variant "default variant" pattern, inventory concurrency safety,
   D1/cookie gotchas) — **read this before touching anything**, these
   conventions apply to every phase above too
3. This file
4. `git log --oneline --reverse` — phase-by-phase commit history
5. `server/database/schema/index.ts` and siblings — current data model
