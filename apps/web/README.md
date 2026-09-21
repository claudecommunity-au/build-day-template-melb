# Boilerplate

A [TanStack Start](https://tanstack.com/start) app deployed on Cloudflare Workers, with [Hono](https://hono.dev) as the top-level `fetch` handler, [Clerk](https://clerk.com) for auth and [Cloudflare D1](https://developers.cloudflare.com/d1/) for data.

## Architecture

`src/server.ts` is the Worker's entry point (`main` in `wrangler.jsonc`). It's a Hono app:

- Hono handles its own routes first (e.g. `/api/health`).
- Everything else falls through to `app.all('*', ...)`, which delegates to TanStack Start's request handler (`@tanstack/react-start/server-entry`) for SSR pages, server functions, and static assets.
- `@clerk/hono`'s `clerkMiddleware()` runs globally, so `getAuth(c)` is available in any Hono route.
- On the TanStack Start side, `src/start.ts` wires the same auth in via `@clerk/tanstack-react-start`'s `clerkMiddleware()`, and `src/routes/__root.tsx` wraps the app in `<ClerkProvider>`.

## Clerk integration

Clerk handles auth in two layers, because a request goes to either Hono or TanStack Start:

| Layer | Package | Where | Gives you |
| --- | --- | --- | --- |
| Hono routes | `@clerk/hono` | `src/server.ts` | `getAuth(c)` in any `app.get(...)` handler, e.g. `/api/health` returns the current `userId` |
| TanStack Start | `@clerk/tanstack-react-start` | `src/start.ts` (request middleware, after CSRF) | auth state for SSR pages and server functions |
| React UI | `@clerk/tanstack-react-start` | `src/integrations/clerk/` | `<ClerkProvider>`, `<Show>`, `<UserButton>`, `<SignIn>`, `useUser()` |

Both middlewares read the same keys, so a session cookie set by the Clerk UI is valid on either side. `@clerk/backend` is used directly where the app calls Clerk's Backend API (`/api/dev-login` and `scripts/create-dev-user.ts`).

### Files

- `src/integrations/clerk/provider.tsx` wraps `<ClerkProvider>` with an `appearance` config. Clerk's components render in a shadow root that the app's CSS variables can't reach, so the brand colors and font from `styles.css` are restated there. Change them in both places.
- `src/integrations/clerk/header-user.tsx` shows `<UserButton>` when signed in and a "Sign in" link to `/login` when signed out. `src/components/header.tsx` renders it.
- `src/routes/login.tsx` renders Clerk's `<SignIn routing="hash" />` for signed-out visitors and a profile card for signed-in ones. Hash routing keeps Clerk's multi-step sign-in flow on `/login` without extra catch-all routes.

### Protecting things

- Hono route: `const { userId } = getAuth(c)`, then return 401 if `userId` is null.
- React: wrap content in `<Show when="signed-in">` / `<Show when="signed-out">`, or read `useUser()`.
- TanStack server functions and loaders: use the `auth()` helper from `@clerk/tanstack-react-start/server`. No route uses it yet.

### Dev login

For local testing and browser automation there's a one-click login that skips the Clerk UI:

1. Set `DEV_LOGIN_EMAIL` and `DEV_LOGIN_PASSWORD` in `.env.local`.
2. Run `bun run create-dev-user` to create the user in your Clerk instance, or reset the password of an existing one.
3. In `bun run dev`, `/login` shows a "Dev login (local only)" button.

The button hits `GET /api/dev-login`. That route looks up the user and mints a 60-second Clerk sign-in token, then redirects to `/dev-login?token=...`. The `/dev-login` page redeems the token with `signIn.ticket()` and `signIn.finalize()`, which creates a real Clerk session and sends you to `/`.

The route returns 404 unless `DEV_LOGIN_EMAIL` is set, and that is the only thing protecting it. Never set `DEV_LOGIN_*` on a deployed Worker. (The button is hidden outside dev builds, but the API route doesn't check for dev mode.)

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

Requires Clerk keys in `.env.local` (see `.env.example`): `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_PUBLISHABLE_KEY` (same value) and `CLERK_SECRET_KEY`. Pull your own with `clerk env pull` after `clerk link --app <app_id>`. The database needs no configuration for local work.

## Build & deploy

`.env.local` only feeds local dev — it's never uploaded. Before the first `wrangler deploy`, set the Clerk keys as real Worker secrets/vars (a deploy without them will 500, the same way local dev did before Clerk keys were added):

```bash
wrangler secret put CLERK_SECRET_KEY
wrangler secret put CLERK_PUBLISHABLE_KEY
wrangler secret put VITE_CLERK_PUBLISHABLE_KEY
```

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
