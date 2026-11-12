# Atelier — Fashion E-commerce Platform

Full-stack Nuxt 4 + Cloudflare Workers e-commerce platform. See `SPEC.md`
for the full project specification and `docs/DEPLOYMENT.md` for one-time
Cloudflare setup.

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
