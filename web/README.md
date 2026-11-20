# Mission Control — web

Next.js 16 + shadcn/ui (Base UI, nova preset). This is the shell: a collapsible sidebar,
the top bar, and one route per module. No data calls yet; the schema lives in `../supabase`.

## Environment

Create `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

The secret never leaves the server: `lib/supabase/server.ts` imports `server-only`, so a
client component that imports it fails the build. The catalog screens read `catalog_items`
through that client.

## Run

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
pnpm typecheck
```

## Structure

- `app/` — routes: `/` overview, `/sales`, `/appointments`, `/customers`,
  `/catalog/{treatments,packages,products,services}`, `/reports`, `/settings`.
- `app/catalog/` — the section layout with its own tab bar; one screen per catalog.
- `components/app-sidebar.tsx` — collapsible sidebar (`collapsible="icon"`), groups and
  active state.
- `components/brand-mark.tsx` — renders `public/logo-legacymd.webp`; replace that file to
  change the logo. The same image is `app/icon.webp`, the favicon.
- `components/ui/` — shadcn components, do not hand-edit unless the registry changes.

The theme starts light; `d` toggles dark anywhere outside an input.
