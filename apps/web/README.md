# Boilerplate

A [TanStack Start](https://tanstack.com/start) app deployed on Cloudflare Workers, with [Hono](https://hono.dev) as the top-level `fetch` handler and [Cloudflare D1](https://developers.cloudflare.com/d1/) for data.

There is no auth. To add it, run the `add-clerk` skill (`.claude/skills/add-clerk`).

## Architecture

`src/server.ts` is the Worker's entry point (`main` in `wrangler.jsonc`). It's a Hono app:

- Hono handles its own routes first (e.g. `/api/health`).
- Everything else falls through to `app.all('*', ...)`, which delegates to TanStack Start's request handler (`@tanstack/react-start/server-entry`) for SSR pages, server functions, and static assets.

## D1

Database access goes through the workspace package [`@repo/db`](../../packages/db) (see its README for the schema, the migrations and the test setup). In this app:

- `wrangler.jsonc` declares the `d1_databases` binding named `DB`, with `migrations_dir` pointing at `packages/db/migrations`. `bun run cf-typegen` turns that into `env.DB: D1Database`.
- `src/server/notes.ts` holds the server functions. Each handler calls `drizzle(env.DB)` from `drizzle-orm/d1`, with `env` from `cloudflare:workers`. That is the one place the binding is read.
- `src/routes/notes.tsx` is the example page: the loader calls `listNotesFn`, the form calls `createNoteFn` and invalidates the router. Its `errorComponent` renders a "could not reach D1" panel.
- Browser code imports only `@repo/db/shared`. The other entries import drizzle and belong in server functions (or Hono routes, where `drizzle(c.env.DB)` works the same way).

`bun run dev` runs `wrangler d1 migrations apply DB --local` before starting Vite, so the local database that Miniflare serves is always up to date. It lives in `.wrangler`, which is gitignored; delete that folder for a clean slate.

## Develop

```bash
bun install
bun run dev
```

The database needs no configuration for local work.

## Build & deploy

The local database only exists on your machine, so the deployed Worker needs a real D1 database. Create one, put the id it prints into `d1_databases[0].database_id` in `wrangler.jsonc`, and create the tables:

```bash
bunx wrangler d1 create boilerplate
bunx wrangler d1 migrations apply DB --remote
```

Then:

```bash
bun run build     # vite build
bun run deploy    # build + wrangler deploy
```

`wrangler.jsonc` has no `account_id` set, so `wrangler deploy`/`wrangler whoami` will use (or prompt for) whichever Cloudflare account is active.

`bun run cf-typegen` regenerates `worker-configuration.d.ts` (the `Env` type) from `wrangler.jsonc` + local env vars — it also runs automatically via `prepare` (`bun install`), so a fresh clone typechecks without a manual step.
