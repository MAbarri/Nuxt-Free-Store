# Nuxt E-commerce Platform — Project Specification

This document captures the project brief, the architectural decisions made for
this implementation, and the phased delivery plan. It is the source of truth
for scope and direction; update it as decisions evolve.

---

## 1. Project Overview

Build a modern, lightweight, full-stack e-commerce application using Nuxt 4
and Vue 3, designed to operate as a complete standalone online store.

The application includes both the customer-facing storefront and a
comprehensive administration dashboard, with all backend functionality
implemented directly within the Nuxt application using Nitro server routes
and server-side services.

The primary objective is to provide a simple but complete e-commerce solution
that allows a merchant to create and manage an online shop, publish products,
manage product variants and inventory, receive customer orders, and process
cash-on-delivery (COD) transactions.

This is a **single-store application**. Multi-tenancy, SaaS subscriptions, and
multi-merchant management are explicitly outside the initial scope.

---

## 2. Technical and Architectural Requirements

### Application stack (decided)

| Concern | Choice |
|---|---|
| Framework | Nuxt 4, Vue 3, TypeScript |
| Server engine | Nitro, `cloudflare_module` preset (deploys as a single Cloudflare Worker) |
| Styling | Tailwind CSS |
| Component library | Nuxt UI (forms, tables, modals, toasts, pagination) |
| ORM | Drizzle ORM |
| Database | Cloudflare D1 (SQLite semantics) |
| Media storage | Cloudflare R2 (product images) |
| Cache / lightweight config | Cloudflare KV (optional caching, e.g. homepage/category cache) |
| Future background work | Cloudflare Queues (not implemented initially, architecture leaves room) |
| Package manager | pnpm |
| Validation | Zod, enforced server-side |
| Auth | Custom session-based auth (see §8) |
| Testing | Vitest via `@cloudflare/vitest-pool-workers` (tests run inside `workerd`, against real D1/R2 bindings) |

### Architecture

- Modular monolithic architecture. Frontend and backend live in the same
  repository and deploy together as one Nuxt application.
- Backend functionality is implemented through Nuxt server routes,
  server-side services, repositories, and middleware.
- Business logic stays independent of the HTTP layer wherever practical
  (services/repositories do not import `h3`/request objects; API routes are
  thin adapters).
- Clear separation of responsibilities without unnecessary complexity or
  microservices.
- Fully compatible with the Cloudflare Workers runtime: no Node-only APIs,
  no native binaries, no persistent local filesystem, no long-running
  background processes, no independently hosted backend.
- Access to infrastructure (D1, R2, KV) goes exclusively through Cloudflare
  bindings.

### Deployment and cost constraints

- Must run on Cloudflare's free tier: Workers, D1, R2, KV.
- No mandatory paid infrastructure or third-party services.
- Kept portable enough to support alternative hosting/DBs later (business
  logic isolated from binding-specific code where practical).
- The developer has an existing Cloudflare account; real D1/R2/KV resources
  are created with `wrangler` as soon as each phase needs them, rather than
  deferring resource creation to the end.

### Deployment mechanism (decided)

Easy, low-friction deployment is a hard requirement. The chosen approach:

- Plain Nitro `cloudflare_module` preset + a hand-maintained `wrangler.jsonc`
  for all bindings (D1, R2, KV) — no extra deployment-platform dependency.
- **Cloudflare Workers Builds** is used for CI/CD: the GitHub repo is
  connected directly to the Cloudflare dashboard, so every push triggers an
  automatic build and deploy. There is no deploy command to remember and no
  third-party CLI/service in the deploy path.
- `NuxtHub` (`@nuxthub/core`) was considered for its convenience composables
  (`hubDatabase()`, `hubBlob()`, `hubKV()`) but is **not** used for
  deployment: as of February 2026, NuxtHub deprecated its own hosted `nuxthub`
  CLI/GitHub Action for deployment and now directs Cloudflare users to
  Workers Builds instead. To avoid depending on a shifting third-party
  platform, this project talks to Cloudflare bindings directly
  (`event.context.cloudflare.env`) rather than through a wrapper module.
- Local dev also uses wrangler-backed bindings (see above), so the local and
  CI/production environments behave identically.
- A one-time setup step provisions the D1 database, R2 bucket, and KV
  namespace via `wrangler d1 create`, `wrangler r2 bucket create`, and
  `wrangler kv namespace create`, with the resulting IDs recorded in
  `wrangler.jsonc`. After that, deployment is fully automatic on every push.

### Cloudflare free-tier limits (reference)

The free tier is expected to comfortably cover a small/medium COD store.
Current limits (subject to change by Cloudflare):

| Service | Free plan limit |
|---|---|
| Workers requests | 100,000 / day |
| Workers CPU time | 10 ms per invocation |
| D1 rows read | 5 million / day |
| D1 rows written | 100,000 / day |
| D1 storage | 5 GB total |
| D1 databases | 10 per account |
| R2 storage | 10 GB-month |
| R2 Class A ops (writes) | 1 million / month |
| R2 Class B ops (reads) | 10 million / month |
| R2 egress | Free, unlimited |
| KV reads | 100,000 / day |
| KV writes / deletes / list | 1,000 / day each |
| KV storage | 1 GB |
| Workers Logs | 200,000 events / day, 3-day retention |

The tightest practical limit is KV writes (1,000/day), which is why
frequently-written data (carts, orders, sessions) lives in D1, and KV is
reserved for lower-frequency caching (e.g. homepage/category cache). All
limits upgrade automatically on the $5/month Workers Paid plan with no code
changes required.

---

## 3. Storefront

A clean, responsive, mobile-first storefront, fully data-driven (no
hardcoded catalog content), designed specifically for a fashion/clothing
merchant.

### Visual design system (decided)

The storefront targets an **editorial minimalist** aesthetic (think COS,
Arket, Everlane) rather than a generic template look:

- **Typography**: a refined serif display face (Fraunces or Libre Caslon)
  for hero copy, product names, and section titles, paired with a clean
  grotesk sans (Inter or General Sans) for body copy, navigation, and
  forms. Uppercase, letter-spaced labels for nav items and badges
  ("NEW", "SALE").
- **Color palette**: warm off-white (bone) background, near-black ink text,
  a single muted **clay/terracotta** accent color, desaturated semantic
  colors (success/error/warning) to stay in tone. All values are placeholder
  and are driven through `store_settings` (or Tailwind theme tokens sourced
  from it) so the merchant's real branding can be swapped in later without
  touching component code.
- **Layout**: generous whitespace and wide margins, full-bleed hero imagery
  with overlay text on the homepage, image-forward product cards with
  minimal chrome, a mega-menu style desktop nav (category thumbnails) and a
  full-screen overlay nav on mobile, a sticky "Add to cart" bar on mobile
  product pages.
- **Photography**: the gallery/card components do not assume a single
  photography style — they use a fixed-aspect-ratio (portrait) container
  with `object-fit: cover` so either lifestyle/model shots or studio/
  ghost-mannequin shots render consistently, at the merchant's discretion
  per product.
- **Motion**: subtle only — smooth page transitions, scroll-reveal fades,
  gentle hover states (e.g. a product card's secondary image fading in on
  hover). No heavy parallax, scroll-jacking, or large animated sequences.
- No logo/brand assets exist yet; the storefront ships with a placeholder
  wordmark and palette, both swappable via `store_settings`.

### Homepage
- Store branding and navigation (generic/placeholder branding initially,
  driven by a `store_settings` table so real branding can be swapped in
  later without code changes).
- Hero/banner section.
- Featured products.
- Product categories.
- Latest products.
- Promotional sections.
- Footer with store information.

### Product catalog
- Product listing pages, category navigation, search.
- Filtering by category and attributes.
- Sorting by price, popularity, newest.
- Pagination.
- Availability indicators.
- Color swatches directly on product cards, for attributes marked with a
  `swatch` display type (see §4).
- Quick-view modal: opens a lightweight product preview from the listing
  grid (reusing the product detail data) without a full page navigation.

### Product details
- Name, description, image gallery, pricing, compare-at/discounted pricing.
- Variants and attributes, available stock, variant SKU, variant pricing,
  variant images where applicable.
- Quantity selection, add-to-cart, related products.
- Size guide/chart: a modal or table, scoped to the product's category (with
  optional per-product override), showing size measurements — standard
  expectation for a clothing storefront.
- Add/remove from wishlist, available to both guests and signed-in
  customers (see below).

### Wishlist (added scope)

Not part of the original brief, added because it's expected in fashion
e-commerce:

- Save/remove products (and optionally a specific variant) without adding
  them to the cart.
- Works for **unauthenticated guests**, using the same guest-token/cookie
  pattern as the cart, for UX consistency — no forced account creation just
  to save an item.
- A guest's wishlist merges into their account automatically on login/
  registration.
- Customers can view and manage their wishlist from their account area.

---

## 4. Product and Catalog Management

### Categories
Create/edit/delete, name, description, image, parent/child relationships,
slug, active/inactive status.

### Products
Create/edit/duplicate/archive/delete, name, description, short description,
SKU, slug, base price, compare-at price, images, category assignments,
attributes, status (draft/active/archived), featured flag, SEO title and
description.

### Product variants
Supports attribute-based variants (size, color, material, etc.) and
variant-less products. Each variant: unique SKU, individual price, stock
quantity, optional image, active/inactive status. Admin UI must make variant
creation straightforward.

### Product attribute display type (added scope)
`product_attributes` carries a `display_type` field (`text` / `select` /
`swatch`). Attributes marked `swatch` (typically Color) store a hex code or
small swatch image per value, so the storefront can render color options as
swatches on product cards and the product page instead of a plain dropdown.

### Size guides (added scope)
A `size_guides` table holds reusable size charts (title + structured
measurement content), assignable to a category and optionally overridden at
the product level. Managed by admins under category/product management.

---

## 5. Shopping Cart

- Add products/variants, update quantities, remove items, clear cart.
- Server-side stock validation, subtotal/total calculation.
- Persisted between visits for unauthenticated users via a guest cart
  token/cookie, backed by D1 (`carts`/`cart_items`).
- Client-side cart data is never authoritative for pricing or inventory —
  everything is revalidated server-side at checkout.

---

## 6. Checkout and Cash on Delivery

COD is the only payment method for this release.

### Checkout form
Full name, phone, email (optional), city, full delivery address, delivery
instructions (optional).

### Checkout process
1. Review cart.
2. Enter delivery information.
3. Validate customer information.
4. Revalidate product availability and prices server-side.
5. Calculate shipping fees.
6. Calculate final order total.
7. Submit order.
8. Create order with COD payment method.
9. Record order + order items.
10. Show confirmation page.

### Order record
Unique order reference, customer info, product/variant info, quantities,
unit prices at purchase time, item subtotals, shipping fee, order total,
payment method, payment status, order status, creation date. Order items
are a denormalized snapshot — historically accurate even if products or
prices change later.

---

## 7. Administration Dashboard

Protected, integrated into the same Nuxt app.

### Overview
Total orders, total revenue, pending orders, orders awaiting confirmation,
delivered orders, recent orders, best-selling products, low-stock products.

### Product management
Listing, creation/editing, category management, variant management, image
management, inventory info, activation/archiving.

### Order management
View/search (by reference, customer name/phone)/filter (status, date), order
detail, status + payment status updates, internal notes, order history,
cancellation, delivery/payment info recording.

**Order statuses**: Pending confirmation, Confirmed, Processing, Shipped,
Delivered, Cancelled, Failed delivery, Returned.

**Payment statuses**: Unpaid, Paid, Refunded. COD orders stay Unpaid until
the merchant records successful collection.

### Customer management
View/search customers, contact info, order history, totals, addresses,
notes.

### Shipping management
Shipping fees, free-shipping thresholds, per-city/region pricing,
enable/disable destinations, delivery info on orders, manual tracking
references, shipping/delivery status updates. No external carrier
integration required.

### Inventory management
Per-variant stock tracking, stock updates, low-stock alerts, stock
adjustment records, prevention of overselling, automatic stock
decrement/restore on order placement/cancellation, adjustment history.
Stock updates must be concurrency-safe (conditional updates / transactions)
to prevent overselling when multiple customers buy the same stock
concurrently.

---

## 8. Authentication and Security

- Customer registration, login, logout, profile, order history.
- Protected admin routes, role-based authorization (`customer` / `admin`).
- **Password hashing**: Web Crypto `SubtleCrypto` (PBKDF2), no Node-only
  crypto libraries, compatible with the Workers runtime.
- **Sessions**: opaque random tokens stored in a D1 `sessions` table,
  delivered via httpOnly + secure cookies; server middleware resolves the
  session and attaches the user/role to the request context on every
  request.
- All admin operations are authorized server-side; the frontend route guard
  is a UX convenience only, never the actual authorization boundary.
- Input validation via Zod on every server route; defenses against common
  web vulnerabilities (XSS, CSRF where relevant, SQL injection via
  parameterized Drizzle queries, open redirect, etc.).

---

## 9. Data Model (Drizzle ORM + D1)

Normalized relational schema, with FKs, indexes (slugs, SKUs, status, dates),
and `created_at`/`updated_at` timestamps throughout.

- `users`, `sessions`
- `customer_profiles`, `addresses`
- `categories`
- `products`, `product_images`, `product_attributes` (with `display_type`:
  text/select/swatch), `product_attribute_values`, `product_variants`,
  `variant_attribute_values`
- `size_guides` (per category, optionally overridden per product)
- `carts`, `cart_items`
- `wishlists`, `wishlist_items` (guest-token or customer-owned, merged on
  login)
- `orders`, `order_items`, `order_status_history`
- `inventory_adjustments`
- `shipping_zones`, `shipping_rates`
- `store_settings`

Order items always store a denormalized snapshot (product name, SKU, unit
price, variant attributes) captured at order-creation time, independent of
later edits to the live product/variant records.

---

## 10. User Experience and Design

Mobile-first, responsive, fast-loading, simple navigation, clear product
presentation, conversion-oriented checkout, intuitive admin workflows,
consistent design system (Tailwind + Nuxt UI), accessible components,
explicit loading/error/empty/success states throughout.

The storefront follows the editorial-minimalist visual design system
described in §3 (serif/sans type pairing, bone/ink/clay palette, subtle
motion), implemented as Tailwind theme tokens sourced from `store_settings`
so branding stays swappable. The admin dashboard uses a neutral, utility-
focused Nuxt UI theme instead, prioritizing operational efficiency over
brand styling.

---

## 11. Non-Functional Requirements

- Strong TypeScript typing end to end.
- Consistent API response structure (success/error envelope) across all
  server routes.
- Server-side validation (Zod) on all inputs.
- Reusable components and composables; modular business logic in
  services/repositories.
- Database migrations via `drizzle-kit`, applied with
  `wrangler d1 migrations apply`.
- Error handling and logging appropriate for the Workers runtime.
- Environment-based configuration (dev/staging/prod bindings).
- SEO-friendly storefront (meta tags, semantic structure, sitemap-friendly
  routing).
- Appropriate caching (e.g. KV-backed caching for read-heavy public pages).
- Secure handling of customer data; no sensitive information ever exposed to
  the client (password hashes, internal notes, other customers' data, etc.).
- Automated tests for critical commerce workflows (cart math, stock
  concurrency, pricing snapshot, checkout/order creation), added
  incrementally alongside each phase rather than deferred entirely to the
  end.
- Attention to Cloudflare Workers execution constraints: CPU time limits,
  request limits, D1 limits, and supported runtime APIs.

---

## 12. Explicitly Out of Scope (initial release)

Multi-tenancy, multiple independent stores, SaaS subscriptions, multiple
merchant accounts, online payment gateways, automated shipping carrier
integrations, Facebook Ads campaign management, advanced marketing
automation, loyalty/rewards programs, AI product generation, AI customer
support, multi-currency management, complex accounting, ERP integrations.

The architecture leaves room for these without implementing them
prematurely.

---

## 13. Project Structure (planned)

```
app/                      # Nuxt 4 app directory (pages, components, layouts, composables)
  pages/
    index.vue, products/, category/, cart.vue, checkout.vue, account/
    admin/                # admin dashboard pages, protected by middleware
server/
  api/                    # thin Nitro route handlers (storefront + admin + auth)
  services/               # business logic: catalog, cart, checkout, order, inventory, shipping, auth
  repositories/           # Drizzle query layer, one module per entity
  database/
    schema/               # Drizzle table definitions
    migrations/           # drizzle-kit generated migrations
  middleware/             # session resolution, admin route guard
  utils/                  # Zod schemas, response helpers, crypto helpers
drizzle.config.ts
wrangler.jsonc
nuxt.config.ts
tests/
  unit/                   # Vitest (vitest-pool-workers), business-logic focused
```

---

## 14. Delivery Plan — Phases

Delivery follows the brief's recommended order strictly. Each phase ends in
a working, demoable slice (migrations + services + routes + UI + tests for
the business-logic-heavy parts).

1. **Foundation**: Nuxt 4 scaffold, Tailwind + Nuxt UI, Cloudflare Workers
   Nitro preset, `wrangler` config and real D1/R2/KV bindings, Cloudflare
   Workers Builds connected to the GitHub repo for automatic deploy on push,
   Drizzle schema + first migration, base layout/design tokens, auth
   (register/login/logout, password hashing, sessions, role-based
   middleware), base API response/error conventions, Vitest harness, git
   repo initialized.
2. **Catalog**: categories CRUD (admin), products CRUD, attributes
   (including `swatch` display type), variants, size guides, product images
   (R2 upload), draft/active/archived status, slugs.
3. **Storefront browsing**: editorial-minimalist design system (typography,
   color tokens, layout components), homepage, listing/category pages,
   search, filter, sort, pagination, product detail page with variants/
   gallery/stock/size guide, color swatches on cards, quick-view modal,
   related products — fully data-driven.
4. **Cart & wishlist**: guest-cart cookie/token, add/update/remove/clear,
   server-side stock + price checks, persisted in D1; guest/account
   wishlist using the same token pattern, merged into the account on login.
5. **Checkout + COD**: checkout form, server-side revalidation of stock/
   price, shipping fee calculation, order + order_items creation, stock
   decrement with overselling protection, confirmation page.
6. **Admin dashboard shell**: protected layout, overview metrics (orders,
   revenue, pending, low stock, best sellers, recent orders).
7. **Order management**: list/search/filter, detail view, status + payment
   status updates, internal notes, status history, cancellation with stock
   restoration.
8. **Customer management**: list/search, profile, order history, addresses,
   notes.
9. **Shipping configuration**: shipping zones/rates by city/region,
   free-shipping threshold, enable/disable destinations, tracking
   reference, delivery status updates.
10. **Inventory management**: stock adjustment UI, low-stock alerts,
    adjustment history, concurrency-safe stock updates (shared with
    checkout).
11. **Hardening**: expanded Vitest coverage on commerce-critical paths,
    security review (headers, input validation, authz checks on every
    admin/customer-scoped route), performance/caching pass, deployment docs
    and a verified end-to-end Workers Builds deploy.

---

## 15. Definition of Success

The initial release is successful when a merchant can:

1. Log into the administration dashboard.
2. Create categories and products.
3. Configure product variants and stock.
4. Publish products to the storefront.
5. Receive customer orders through the storefront.
6. Accept cash-on-delivery orders.
7. Manage and update orders.
8. Manage customers and their order histories.
9. Configure shipping fees.
10. Track inventory and stock adjustments.

A customer must be able to browse the store, select product variants, add
products to their cart, complete checkout without creating an account, and
successfully submit a COD order.

The complete application must be deployable as a single Nuxt 4 project on
Cloudflare Workers, using Cloudflare-managed infrastructure, without
requiring a traditional VPS or independently hosted backend.
