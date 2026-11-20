# Handoff — LegacyMD Mission Control

**Date:** 2026-11-20 · **State:** the data layer, the screens and the login gate are built and committed; the dashboards are being built by the owner with another LLM.

Read this first when resuming. Then `AGENTS.md` and `memory/current-strategy.md`.

## Where things live

| What | Where |
|---|---|
| Supabase project | `konjxlatjymqrzebvtdu` (`https://konjxlatjymqrzebvtdu.supabase.co`), Postgres 17, us-east-2 |
| Credentials | `.env.local` (gitignored): publishable key, secret key, `SUPABASE_ACCESS_TOKEN`, test user |
| Schema | `supabase/migrations/*.sql` (30 files, applied in filename order) |
| Query helper | `scripts/query.py "SELECT ..."` or `scripts/query.py @file.sql` |
| Apply migrations | `scripts/apply_migrations.py` (applies only what is not in `public.schema_migrations`, stops on the first error, then re-applies the lock-down file) |
| Import generators | removed with the import: the base is loaded, the source exports live outside the repo (`F:\EmpathoAI-projects\_legacymd-datos-fuente`) |
| Reports | removed with the import; the same data lives in the database and in `docs/data/baseline.json` |
| Repository | local git, first commit `4f3aa38`; `github.com/empathoai/legacymd-mission-control` still does not exist |

Python with openpyxl: `C:\Users\aguaj\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`

## Numbers as of handoff

| | |
|---|---|
| Customers | 215 |
| Sales | 435 (after the test records were removed) |
| Sale items | 588 |
| Receipts | 435, sum equals revenue |
| Returns | 0 |
| Revenue | **219.460,91** (consolidated import, 2026-11-20) |
| Balance outstanding | **0,00** |
| November 2026 | **18.599,92** sold and collected |
| Expenses | 7 periods (May–Oct closed, Nov open), 98 live entries + 1 voided, total **247.350,49** (equals the sheet) |
| Appointments | 51 |
| `import_review` | 20 rows, all `rejected` (closed with the owner's answer), 0 pending |
| Catalog | 93 active catalog items across treatments, packages, memberships, products and services |
| Migrations | 92, all recorded in `public.schema_migrations` |
| Checks | 19, with their negative controls; the baseline holds at 435 historical sales |
| Remote | **none**: `git remote -v` is empty, so nothing is pushed |

## Handover — the dashboards and the sales report

**The owner is designing and building them with another LLM.** This session stops at the data contract: it keeps the base, the checks and the entry screens, and it answers questions. It does not draw the reporting surface.

What the other side can read:

| View | What it gives |
|---|---|
| `monthly_pl` | the month, gross revenue, cost of goods and margin |
| `cash_collected` | money in, by month of receipt |
| `monthly_money` | revenue, returned and net revenue per month |
| `sale_money` | one row per sale: total, collected, returned, balance, voided |
| `customer_balances` | per patient: sold, collected, balance, visits (distinct days), next due, overdue |
| `item_profitability`, `item_monthly_profitability`, `refunded_by_item` | margin per item, per month, and what came back |
| `catalog_items` | the 93 active items across the five kinds |

Rules that hold whatever the screen shows: months group by `occurred_on`, never by `created_at`; a sale is never edited (a return is a new row, a void marks the sale); a patient may have several sales in a day and they share the visit ordinal; cash never includes a voided sale.

Numbers on 2026-11-20: 215 patients, 435 sales, 588 lines, 435 receipts, 0 returns, **219.460,91** sold and collected, **0,00** owed, November **18.599,92**.

Ask this side about the base; do not change the base to fit a chart.

## Access model (decided 2026-11-19)

**`pnpm dev` runs without a password on purpose.** `web/proxy.ts` skips the gate while `NODE_ENV !== "production"`, so the owner — or another agent reviewing the dashboards — opens the app straight away; a write made in that state records `dev@local` as its actor. A production build always asks for the clinic account (`empathoai@gmail.com`), and its password is reset from the Supabase dashboard.

Server-only. `anon` and `authenticated` hold **no grants** on `public`, every view is
`security_invoker`, and RLS stays enabled with zero policies as a second layer. The
Next.js server uses the secret key (`service_role`, which bypasses RLS); the browser
never talks to the Data API. Login and sessions are unaffected (they live in `auth`).

Verified live: publishable key → `401 permission denied` on `customers` and
`customer_balances`; secret key → `200`.

## How the import was reconciled

- Source workbook: `docs/Ingresos Follow-Up.xlsx`, 506 dated rows → 505 sales rows → 470 sales (days with two rows became one sale with two items).
- Rows with no quantity were not imported (a product-only sale is normal, not an error).
- Rows with a `Total` and no unit price took the total as the unit price.
- Rows that were truly zero: 10, all discontinued or one-off packages.
- Two dates had a wrong year (2022, 2025) and were clamped inside their own month.

## Decisions already made (do not reopen)

1. Single tenant, no `org_id`.
2. Three catalogs: `treatments`, `products`, `services`.
3. Category lives on the sale line, catalogs only carry a default.
4. Payments are a schedule (`sale_payments`); Stripe is month-to-month, Cherry/Care Credit settle in full at sale time.
5. New vs repeat comes from `is_first_visit`; source only on the first visit.
6. Packages: `unit_type = 'package'`, quantity always 1, price and free-text `description`. Contents are not modelled.
7. Margin is `revenue − cost`, no conditional logic anywhere.
8. Costs: treatments/services have catalog costs (8 treatments estimated); **products cost $1.00 placeholder** until the owner gives the real average.
9. A cost is a price interval (`item_cost_history`); a sale never stores one and its margin is derived from the interval covering the sale date. A change dated today cannot touch yesterday; correcting a past interval changes the margin without touching a sale.
10. Access is server-only; the browser never uses the publishable key against `public`.

## Work in order

`memory/next-actions.md` carries the ordered list; `memory/current-strategy.md` says what is *now*.

1. **Built and verified:** the base, the migrations with their 19 checks and controls, the catalog (five tabs, search, margin), patients, sales details, the sale entry screen, the appointments agenda, expenses, returns, voids, open items, and the login gate with the actor read from the session.
2. **Owned elsewhere:** the dashboards and the sales report — the owner builds them with another LLM. This side keeps the data contract and answers questions; it does not draw the screen.
3. **Next here:** the UX backlog U2–U7 from [`ux-audit-2026-11-20.md`](ux-audit-2026-11-20.md), in its order.
4. **Then:** product costs, the branded PDF of the patient report, deploy to Vercel, and the Google Calendar feed once the account access exists.

Owner data that is not a blocker: real product costs, package descriptions. The base is 435 sales, 588 lines, 435 receipts, 219.460,91 collected, 0,00 owed (consolidated import, 2026-11-20).

## Returns and money returned: the rule

Decided (D2): anything that means money leaving a sale is its own transaction in
`sale_refunds` — customer → sale → amount (full or partial) → method → date →
reason, plus `kind` (`refund` | `chargeback`), `external_id` for the Stripe refund
and a reconciliation state (`pending` → `refunded`). The sale is never edited and a
sale with receipts can never be voided, only returned; `void` stays a state on the
sale for sales where nothing was collected.

The screen calls `register_return(sale, amount, method, date, kind, reason, by)` and
later `settle_return(return_id, date, external_id)`. A pending return makes the balance
negative; settling it brings the balance back to zero without touching the sale.

Not built yet: the table, the screen, and the net-revenue view. The schema still
forbids the old shortcuts on purpose — `sale_items.unit_price >= 0` and
`sale_payments.amount >= 0`.

What the workbook did, ad hoc in its summary block, none of it in the database:

| Month | Line | Amount | Where it goes |
|---|---|---|---|
| July | `Sripe` (Stripe) | +1.130 | nowhere: unallocated cash, excluded (D4) |
| August | Refund for Frank Alonso, a workbook summary line | −837 | `sale_refunds`, August |
| September | `Stripe No-Show` | +1.876 | `adjustments`, September |
| October | `Stripe No-Show` | +1.151 | `adjustments`, October |

Attribution (D4): revenue by sale date, cash by receipt date, returns and write-offs
by the month they happen. Sales months are not closed; only expense months are.

## Installment calendar (decided, not built)

`pending` and `void` are exclusive. Cancelling the future voids the remaining installments
from a cutoff date with a reason; the forecast is computed from `pending`, so it
drops on its own and the cancelled installments never ask for confirmation. Voiding does
not move the balance: forgiving the uncollected remainder needs a write-off
adjustment (revenue down, cash unchanged).

Rescheduling moves `due_on` of pending installments only, with an audit row (from, to,
when, who, why). A day missing in the month clamps to the last one; a past date is
rejected. Paid installments never change date.

No Stripe integration: the owner cancels or moves the subscription in Stripe by hand,
and the monthly reconciliation box is where reality corrects the plan. A charge that
arrives after cancellation is an unexpected receipt, not a pending installment.

## Gotchas learned the hard way

- PowerShell 5.1 `ConvertTo-Json` corrupts long strings; all SQL goes through `scripts/query.py` (Python).
- `create or replace view` cannot add columns in the middle → always `drop view` first.
- Generated columns cannot reference other generated columns (`line_margin` uses `unit_price`, not `line_total`).
- BOM in a `.sql` file breaks the Management API; write files as UTF-8 without BOM.
- **`apply_migrations.py` never re-runs an applied file.** It records every file in `public.schema_migrations`, skips what is there, and stops on the first error, because two files are not re-runnable: `091000` replaces a view whose shape changed later, and `091400` drops the expense tables and would wipe the 99 loaded entries. Never edit the ledger to force a re-run; write a new numbered file.
- A cost lives only in `item_cost_history` as an interval. The catalogs have no cost column. Use `set_item_cost(kind, id, cost, from_timestamp)` for a change and `calibrate_month_cost(kind, id, month, cost, by)` for a past month; neither touches a sale.
- Control columns, and where each lives: `sales.voided_at/void_reason/voided_by` (guarded by `sales_guard_void`); `sale_payments.voided_at/void_reason/voided_by` (guarded by `sale_payments_guard`); `sale_payment_changes` for every reschedule; `sale_refunds.state/refunded_at/recorded_by`; `payment_receipts.recorded_by` (append-only, never voided); `cost_calibrations.calibrated_by`. Use `void_sale`, `void_payment` and `reschedule_payment`; a raw update can break the coupling.
- UI checks: Playwright, headless, dark theme, 1440×950, then read the screenshot back. The app runs at `http://localhost:3000` under `next dev`; `playwright` is global and Chromium lives under `%LOCALAPPDATA%\ms-playwright`. Never ask the owner for a capture and never dump the DOM into the conversation.
- The baseline lives in `docs/data/baseline.json` (435 sales, 219.460,91, per-sale salted hash); the pre-import one is kept as `docs/data/baseline-2026-11-19.json`. `run_checks.py` compares it after every batch; regenerating it needs `--force` and is only legitimate before a cutover.
- Appointments live in `appointments`; never update a status or a slot directly: use `resolve_appointment` and `reschedule_appointment`. A sale links by `sales.appointment_id` and resolves the booking to `show_up`; `customer_balances` only lists customers with a money fact.
- The bot's bookings arrive at `POST /api/ghl/appointments` with `x-ghl-secret` (`GHL_WEBHOOK_SECRET` in `web/.env.local`), idempotent on `appointments.external_ref = ghl:<id>`. The calendar must exist in `ghl_calendar_map` or the delivery is a `422` by design; the map is read before the customer is resolved, so a refused delivery leaves no person behind.
- Three times per sale, and they are not interchangeable: `occurred_on` is the business day and the only grouping key; `billed_at` is the billing moment and resolves the cost interval, `billed_at_source = 'reconstructed'` means the import guessed it as the visit day at noon; `created_at` is the technical insert and for imported rows is the import afternoon. Never group or filter by `created_at`.
- The lock-down file is an invariant, not a one-off.
- **New tables get no grants for `anon`/`authenticated`** because `20261119092800` also revokes the default privileges; `service_role` keeps its default grant. Do not "fix" a missing grant by granting to `anon`.
- The publishable key returning 401 is the intended state, not a bug.
- Never re-run the import generators now: they read the pre-merge customer CSV and would drop sales.
- The sandbox needs `WRITE_OWNER` on the project folder to provision a workspace; if listing fails with a Windows permission error, run the `diagnose-windows-sandbox-acl` skill instead of retrying.
