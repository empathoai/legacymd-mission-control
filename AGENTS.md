# LegacyMD Mission Control — AGENTS.md
*Updated 2026-11-21 · the consolidated base is loaded, the desk screens are built, the app is behind a login gate and **deployed on Hostinger** (`real-darkgray-tarsier-88.hostingersite.com`, auto-deploy from `master`). Appointments left the system: the tool records patients and sales only. The dashboards and the sales report are the owner's, built with another LLM.*

## The project
A single med spa replacing the workbook it uses to log daily sales. The clinic records a sale when the patient arrives, from a PC.

Done when the owner logs a sale in seconds and, without Excel, reads how much came in, how many patients are new, what each treatment left, and how much is still owed.

Out of scope: inventory, package composition, lifetime-value analytics, upselling.

## Non-negotiables
- **The transactional base is immutable.** No deleting lines, repointing items or rewriting amounts. A correction lives in a read-layer view, or in the realignment procedure that runs once the price and cost lists are defined, using the validity intervals. `docs/data/baseline.json` is compared, never regenerated to make a check pass.
- **Server-only access.** `anon` and `authenticated` hold no grants on `public`, every view is `security_invoker`, RLS stays on with zero policies. The secret key lives in `web/.env.local` and never reaches the browser.
- **Money.** Balance = sold + adjustments(revenue − cash) − collected − pending returns. Margin = revenue_with_cost − cost, taken from the cost interval covering `billed_at`; a line never stores a cost, and a sale freezes its `list_price`. Payments are a schedule; there is no Stripe integration, Stripe is reconciled monthly by hand.
- **Time.** Every sale carries `occurred_on` (business day), `billed_at` (billing moment) and `created_at` (technical). Reports group by `occurred_on`, never by `created_at`.
- **People.** One customer master. `sales.visit_number` is the **purchase ordinal**: 1 is the patient's first business day with a sale. A business day is a visit, so several sales that day share the ordinal and only the first is a first visit; `visits` counts distinct days. Days the patient came and nothing was sold are not recorded — appointments left the system on 2026-11-21, and the ordinal gaps they left in the imported history are inherited from the workbook, never produced forward. Patients are adults: a recorded birth date is 18 years or older.
- **Catalog taxonomy.** Treatments carry `unit_type` (unit, package, membership); products and services are their own tables. A name is unique per kind, and an item never changes kind to fix a past sale. Definitions: [catalog-taxonomy.md](docs/catalog-taxonomy.md).
- **Language.** Code, comments, database messages, documentation and UI in English. Free text the owner types is stored as written. The conversation runs in Spanish.
- **Vocabulary.** The schema says `customer` — tables, functions, views, columns — and stays that way. Everything the owner reads says `patient`: routes, headings, labels, buttons. The seam is the value, not the layer: a row is a customer until it renders, and only strings cross. A file never mixes both words; when one does, it is a duplicate read to merge, not a naming debate.
- **Neutral copy.** No she, no he, no her, no his — anywhere in the interface, including placeholders and empty states. `scripts/check_copy.py` fails on one.
- **UI/UX is the owner's, not this session's.** Every screen — routes, layout, components, copy, dialogs, styling — is designed and built by the owner with another agent. This session does not create, restyle, re-layout or "fix" a screen, does not add a route, and does not run a UX pass; it keeps the base, the migrations, the checks, the data contracts and the server actions, and it answers what the other side asks. When a data change would need a screen change, say so and stop there. The UX backlog in `memory/next-actions.md` belongs to the owner.

## Tooling
- **Verify the UI with Playwright, never by asking for a screenshot.** The app runs at `http://localhost:3000` (`next dev` in `web/`). Playwright is installed globally (`playwright` from npm global; Chromium under `%LOCALAPPDATA%\ms-playwright`). Open the page, force dark (`localStorage.theme = "dark"`), interact, screenshot, and read the image back before reporting a UI change.
- **Use the installed component library for every control.** The UI is shadcn/ui over Base UI (`@base-ui/react`, `components/ui/*`). When a control is missing, add it with `pnpm exec shadcn add <name>`; never hand-roll a widget (native `<select>`, custom dropdown, custom input) when the library has one.
- **The login gate is off in development and on in production.** `web/proxy.ts` skips the check when `NODE_ENV !== "production"`, so a screen can be reviewed with no password; a write made that way records `dev@local` as its actor. A build always asks for the clinic account.

## Where things live
Next.js 16.4.5 + React 19 + shadcn/ui (Base UI) in `web/`; Supabase Postgres 17, project `konjxlatjymqrzebvtdu`. `pnpm dev` inside `web/`.

- [memory/README.md](memory/README.md) — the memory map and its cadence. That table is the source of truth; it is not repeated here.
- [memory/decisions.md](memory/decisions.md) — the long reasoning behind every rule above, and the payment, void and installment mechanics.
- [docs/HANDOFF.md](docs/HANDOFF.md) — how to resume: scripts, current numbers, gotchas.
- [docs/catalog-taxonomy.md](docs/catalog-taxonomy.md) · [docs/import-plan-consolidated.md](docs/import-plan-consolidated.md) · [docs/branding.md](docs/branding.md)
- `supabase/migrations/` — **119** files, applied once each and recorded in `public.schema_migrations`. `scripts/apply_migrations.py` applies them; `scripts/run_checks.py` runs the **22** checks with their controls and compares the baseline.
- `web/` routes cover the catalog (five tabs, search, margin), patients (searchable report, detail), sales details (date filter, pagination, footer total, real status) and the sale page (`/sales/<id>`: lines, plan, receipts, returns), **Returns** (`/sales/returns`) and **Voids** (`/sales/voids`) as two separate sections, open items (`/open-items`), expenses by month (`/expenses`, closed months frozen), the sales entry screen (`/sales/new`, written through `public.create_sale(...)`), the dashboards and the sales report. **There is no appointments surface**: the clinic keeps its diary outside and the 51 imported rows are an archive (`docs/data/appointments-2026-11-21.json`). There is no `/api` route.
- Deployment: [docs/deploy-hostinger.md](docs/deploy-hostinger.md) — root `web`, Node 22, npm, `next build --webpack`, three environment variables; every push to `master` deploys.

## Close-out
A session is closed only when `memory/` matches the code:
- a dated entry in [`memory/session-summaries.md`](memory/session-summaries.md);
- the *now* in [`memory/current-strategy.md`](memory/current-strategy.md);
- [`memory/next-actions.md`](memory/next-actions.md) with what finished removed;
- [`memory/bugs-and-risks.md`](memory/bugs-and-risks.md) with what broke or could break;
- [`memory/decisions.md`](memory/decisions.md) with every decision, the day it is taken.

Delete or mark stale files in the same pass: generated SQL, extracts of a replaced base, tables of an import that no longer exists.
