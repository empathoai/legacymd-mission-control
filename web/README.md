# LegacyMD Mission Control — web

The Next.js app that replaces the clinic's sales workbook. It records patients and sales, and
reads the money back: collected, owed, margins, expenses, open items, returns and voids.

## Stack

- Next.js 16.4.5 (App Router) + React 19, TypeScript, Tailwind v4, shadcn/ui over Base UI.
- Supabase Postgres 17 as the only data store. The server uses the secret key; the browser
  never talks to the database.
- pnpm 11, Node 22 (`engines` and `.nvmrc`).

## Run it

```bash
pnpm install
cp .env.example .env.local   # then fill the three values
pnpm dev                     # http://localhost:3000, no login in development
```

| Script | What it does |
|---|---|
| `pnpm dev` | development server; `web/proxy.ts` skips the login gate |
| `pnpm build` | production build; the gate is enforced at runtime |
| `pnpm start` | serves the build; reads `PORT` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

## Configuration

Three variables, in `.env.local` or the host's panel:

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | every Supabase client |
| `SUPABASE_PUBLISHABLE_KEY` | the auth client and the middleware (falls back to the secret key if absent) |
| `SUPABASE_SECRET_KEY` | the server's reads and writes; never reaches the browser |

## Layout

- `app/(app)/` — every screen behind the shell; `app/login` is outside it.
- `app/(app)/*/actions.ts` — server actions; writes go through Postgres functions
  (`create_sale`, `record_receipt`, `register_return`, …).
- `lib/` — one module per read, each `import "server-only"`.
- `components/ui/` — shadcn primitives; `components/` — the screens' pieces.
- `app/shadcn-tailwind.css` — vendored from the shadcn package so the build never needs
  devDependencies.

The database schema, the migrations and the checks live one level up, in `../supabase` and
`../scripts`.
