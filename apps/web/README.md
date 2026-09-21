# Boilerplate

A [TanStack Start](https://tanstack.com/start) app deployed on Cloudflare Workers, with [Hono](https://hono.dev) as the top-level `fetch` handler and [MongoDB](https://www.mongodb.com) for data.

There is no auth. To add it, run the `add-clerk` skill (`.claude/skills/add-clerk`).

## Architecture

`src/server.ts` is the Worker's entry point (`main` in `wrangler.jsonc`). It's a Hono app:

- Hono handles its own routes first (e.g. `/api/health`).
- Everything else falls through to `app.all('*', ...)`, which delegates to TanStack Start's request handler (`@tanstack/react-start/server-entry`) for SSR pages, server functions, and static assets.

## MongoDB

Database access goes through the workspace package [`@repo/mongo`](../../packages/mongo) (see its README for the driver setup, the local database and the Workers-specific reasoning). In this app:

- `src/server/notes.ts` holds the server functions. Each handler wraps its work in `withDb(env.MONGODB_URI, ...)`, with `env` from `cloudflare:workers`. That is the one place the connection string is read.
- `src/routes/notes.tsx` is the example page: the loader calls `listNotesFn`, the form calls `createNoteFn` and invalidates the router. Its `errorComponent` renders a "could not reach MongoDB" panel, which is what you see when the local database is not running.
- Browser code imports only `@repo/mongo/shared`. The package root imports the driver and belongs in server functions (or Hono routes: `withDb(c.env.MONGODB_URI, ...)` works there too).

`MONGODB_URI` names the database in its path. The default in `.env.example` points at the local server that `bun run dev` starts; for Atlas, paste the cluster's `mongodb+srv://` string instead.

## Develop

```bash
bun install
bun run dev
```

`MONGODB_URI` can stay at its `.env.example` default for local work.

## Build & deploy

`.env.local` only feeds local dev — it's never uploaded. Before the first `wrangler deploy`, set everything the Worker reads from `env` as a real Worker secret:

```bash
wrangler secret put MONGODB_URI
```

`MONGODB_URI` must be an Atlas (or otherwise reachable) connection string; the local server only exists on your machine. Use the cluster's `mongodb+srv://...` string with the database name in its path, and allow connections from anywhere in Atlas Network Access (Workers have no fixed egress IPs). Then create the indexes once against that database:

```bash
cd ../../packages/mongo
MONGODB_URI='mongodb+srv://...' bun run ensure-indexes
```

Then:

```bash
bun run build     # vite build
bun run deploy    # build + wrangler deploy
```

`wrangler.jsonc` has no `account_id` set, so `wrangler deploy`/`wrangler whoami` will use (or prompt for) whichever Cloudflare account is active.

`bun run cf-typegen` regenerates `worker-configuration.d.ts` (the `Env` type) from `wrangler.jsonc` + local env vars — it also runs automatically via `prepare` (`bun install`), so a fresh clone typechecks without a manual step.
