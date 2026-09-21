# Boilerplate

A [Turborepo](https://turborepo.com) monorepo, managed with Bun workspaces.

## Apps

- [`apps/web`](apps/web) — the [TanStack Start](https://tanstack.com/start) front end, deployed on Cloudflare Workers, with [Clerk](https://clerk.com) for auth and [Cloudflare D1](https://developers.cloudflare.com/d1/) for data. See its [README](apps/web/README.md) for architecture, the Clerk integration, and setup.

## Packages

- [`packages/db`](packages/db) — `@repo/db`: the Drizzle schema for D1, the generated migrations, and the example `notes` table. See its [README](packages/db/README.md).

## Develop

```bash
bun install
bun run dev
```

`bun run dev` applies the D1 migrations to a local database and starts the web app. The local database is SQLite, run by [Miniflare](https://developers.cloudflare.com/workers/testing/miniflare/) under the Cloudflare Vite plugin, and lives in `apps/web/.wrangler`. No account and no Docker needed. Open the Notes page to see the round trip.

Commands at the root run across all apps via [Turborepo](https://turborepo.com):

- `bun run dev` — start all apps in dev mode
- `bun run build` — build all apps
- `bun run deploy` — build and deploy all apps
- `bun run preview` — preview production builds
- `bun run check` / `bun run fix` — lint/format the whole repo with [Ultracite](https://ultracite.ai)
- `bun run test` — run every workspace's tests

To run a command for a single app, use turbo's filter flag, e.g. `bunx turbo run dev --filter=web`, or `cd apps/web && bun run dev`.

## Deploy

Local development needs none of this. You only need the accounts below when you want the app running on the internet.

### 1. A Cloudflare account

The web app deploys to [Cloudflare Workers](https://workers.cloudflare.com). The free plan is enough. Sign in once from the terminal:

```bash
cd apps/web
bunx wrangler login
```

If you belong to more than one Cloudflare account, `wrangler deploy` will ask which one to use; set `CLOUDFLARE_ACCOUNT_ID` in `apps/web/.env.local` to skip the prompt. The Worker's name comes from `apps/web/wrangler.jsonc` (the `rename-project` skill sets it).

### 2. A D1 database

The local database only exists on your machine, so a deployed Worker needs a real [D1](https://developers.cloudflare.com/d1/) database. It is on the same free plan as the Worker:

```bash
cd apps/web
bunx wrangler d1 create boilerplate
```

That prints a `database_id`. Put it in the `d1_databases` entry in `apps/web/wrangler.jsonc`, replacing the `"local"` placeholder, then create the tables:

```bash
bunx wrangler d1 migrations apply DB --remote
```

Repeat the `migrations apply --remote` whenever `packages/db` gains a new migration.

### 3. Secrets on the Worker

`.env.local` never leaves your machine. Everything the Worker reads from `env` has to be set as a secret before the first deploy:

```bash
cd apps/web
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_PUBLISHABLE_KEY
wrangler secret put VITE_CLERK_PUBLISHABLE_KEY
```

Each command prompts for the value. Never set `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` on a deployed Worker; their absence is what disables the dev login route.

### 4. Ship it

```bash
bun run deploy
```

That builds and runs `wrangler deploy`. The URL is printed at the end; open `/notes` on it to confirm the database binding. Repeat step 3 only when a secret changes.

## License

[MIT](LICENSE)
