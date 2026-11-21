# Deploy on Hostinger from GitHub

Verified locally from a fresh clone, exactly as the host runs it: `npm ci` → 0, `npm run build`
→ 0, `npm start` → `/` answers **307 → /login**, `/login` **200**, `/expenses` **307**.

## Panel settings

| Setting | Value |
|---|---|
| Repository | `github.com/empathoai/legacymd-mission-control` |
| Branch | **`master`** (the default branch here; the panel may suggest `main`) |
| Framework | Next.js |
| Application root | **`web`** — the Next app lives there, not at the repository root |
| Package manager | **npm** (`package-lock.json` is committed for it) |
| Install command | `npm ci` (falls back to `npm install` if the panel has no `ci`) |
| Build command | `npm run build` — the script runs `next build --webpack` because the host's Turbopack crashes on `app/globals.css`; verified from a fresh clone (build 0, `/` 307, `/login` 200) |
| Start command | `npm start` — `next start`, which reads the `PORT` the host sets |
| Node.js | **22** (`engines.node >= 22`, `.nvmrc`) — 20 is too old for `@supabase/supabase-js` |

Two lockfiles exist on purpose: `web/pnpm-lock.yaml` for local development, `web/package-lock.json`
for the host. Both were resolved from the same `package.json`.

## Environment variables (panel, never in git)

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the project URL; the app throws without it |
| `SUPABASE_PUBLISHABLE_KEY` | the auth client and the middleware; without it they fall back to the secret |
| `SUPABASE_SECRET_KEY` | the server's reads and writes; it must never reach the browser |

`web/.env.example` lists them with no values. Not needed on the host: `SUPABASE_ACCESS_TOKEN`
(the Python scripts only), `GHL_WEBHOOK_SECRET` (no `/api` route exists), `EMAIL`/`PASSWORD`.

## What this app is, in deploy terms

A full Next.js server app: server components, Server Actions (`app/(app)/*/actions.ts`),
middleware (`web/proxy.ts` gates every route in production) and server-side auth. There is no
`output: "export"`, no `vercel.json`, no Edge runtime, no `@vercel/*`, no cron and no image
domains — everything the host needs is `next build` and `next start`.

The build **needs devDependencies** (Tailwind and its PostCSS plugin). `npm ci` installs them by
default; a production-only install would fail the build. The shadcn CSS is vendored in
`web/app/shadcn-tailwind.css`, so that package is not needed at build time.

## After the first deploy

1. Open the URL: it answers **307 → `/login`**.
2. Sign in with the clinic account; a write records that email as its actor.
3. The dashboard reads today; `/sales/new` writes through `create_sale`.

The login gate is **on** in production. Development is the environment that runs without a
password.

## When a deploy fails, check in this order

1. **App root**: "no package.json" means the root is still the repository root.
2. **Node version**: 20 → `@supabase/supabase-js` refuses to load.
3. **`npm ci` without the lock**: the lock is committed; if the panel still fails, `npm install`.
4. **Missing env**: the build succeeds without them and the first request throws — set them
   before opening the site.
5. **Build logs**: the first failing line names the missing variable or command.

## Rollback

Redeploy the previous commit from the panel. Nothing in the repository depends on the host.

## Before publishing, still open

- The `sbp_` account token in the root `.env.local` is still valid; revoke it once the schema
  work pauses.
- The clinic account's password reset happens in the Supabase dashboard.
