# Deploy on Hostinger from GitHub

The panel pulls the repository and runs the commands below. No console needed. Two settings
decide whether it works: **the app root is `web/`**, and **Node must be 22**.

## Panel settings

| Setting | Value |
|---|---|
| Repository | `github.com/empathoai/legacymd-mission-control` |
| Branch | `master` |
| Application root | **`web`** — the Next app lives there, not at the repository root |
| Node version | **22** (the project declares `engines.node >= 22` and `.nvmrc` = 22) |
| Install command | `pnpm install` if the panel offers pnpm; otherwise `npm install` |
| Build command | `pnpm build` / `npm run build` |
| Start command | `pnpm start` / `npm start` (`next start`; it reads the `PORT` the host sets) |

The build no longer depends on devDependencies for CSS: `web/app/shadcn-tailwind.css` is a
vendored copy, so a production-only install still compiles. `shadcn` stays a devDependency
for the CLI that adds components.

## Environment variables (panel, never in git)

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the project URL; the app throws without it |
| `SUPABASE_PUBLISHABLE_KEY` | the auth client and the middleware; without it they fall back to the secret |
| `SUPABASE_SECRET_KEY` | the server reads and writes; it must never reach the browser |

Not needed on the host: `SUPABASE_ACCESS_TOKEN` (the Python scripts only), `GHL_WEBHOOK_SECRET`
(there is no `/api` route any more), `EMAIL`/`PASSWORD`.

## After the first deploy

1. Open the URL: it answers **307 → `/login`**.
2. Sign in with the clinic account; a write records that email as its actor.
3. The dashboard reads today; `/sales/new` writes through `create_sale`.

The login gate is **on** in production (`web/proxy.ts` checks `auth.getClaims()`). Development
is the environment that runs without a password.

## What to check when a deploy fails

- **App root**: if Hostinger reports "no package.json", the root is still the repository root.
- **Node 20**: `@supabase/supabase-js` and `cn` require Node ≥ 22.
- **`npm ci`**: there is no `package-lock.json` (the project uses pnpm); the panel must run
  `npm install`, not `npm ci`.
- **Missing env**: the build succeeds without them, the first request throws — set them before
  opening the site.

## Rollback

Redeploy the previous commit from the panel. Nothing in the repository depends on the host.
