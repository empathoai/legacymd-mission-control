# Next Actions

Punch list. One line per action, imperative, with the owner when it is not me. At session close, finished items are summarised in [`session-summaries.md`](session-summaries.md) and removed from here.

## Blockers

- **None.** The Google Calendar access is no longer a blocker: appointments left the system on 2026-11-21.

## Next

### Pre-release corrections — plan: [`../docs/superpowers/plans/2026-11-21-pre-release-corrections.md`](../docs/superpowers/plans/2026-11-21-pre-release-corrections.md)

1. [x] **Task 1 — publishable key**: `SUPABASE_PUBLISHABLE_KEY` in `web/.env.local`, verified 2026-11-21: probe exit 0, `pnpm build` exit 0, and a production server answered 307 on `/sales/details` and 200 on `/login` — the gate no longer falls back to the secret.
2. [x] **Task 2 — a cancelled installment writes off what it stops expecting**: `void_payment` now inserts the `write_off` adjustment for what it still expected (`20261122100000`). Probe: −50,00 written off, balance 0,00, C01 green. Check C21 + control, suite 21 checks / 20 controls.
3. [ ] **Task 3 — date guards**: no future `occurred_on`/`received_on`/`refunded_on`, `billed_at >= occurred_on`, `settle_return` gains `p_by`. Check C22 + control.
4. [ ] **Task 4 — `set_item_price` never moves the catalog backwards** when a later interval exists.
5. [ ] **Task 5 — `cost_on(date)` at clinic midnight**: 56 of 137 intervals answer the wrong cost today; check C23.
6. [ ] **Task 6 — the suite keeps its promises**: the missing C16 control and the C11 control whose RLS branch can never fire.
7. [ ] **Task 7 — pin the build**: `engines.node >= 22`, `packageManager`, `shadcn` out of `dependencies`; `pnpm audit --prod` at 0.
8. [ ] **Task 8 — the record matches the code**: `AGENTS.md` migration count and the removed appointments route, `HANDOFF.md` numbers, the "no remote" line.

**Not in the plan, the owner's:** the mobile drawer that never closes, `/expenses/<period>` at 680 px, Returns/Voids losing their action column, catalog names at 84 px, KPI truncation, and the five lint errors inside components.

### Appointments leave the system (decided 2026-11-21)

0. [x] **Sessions and zero value** (migrations `20261121240000`, `20261121250000`): `treatments.sessions_minimum` = 4 on `PCK-0016` and `PCK-0015`; `session_progress` and `session_gaps` group a program's history by name across its package and unit rows; `sale_items` refuses a price or a total of zero. Today: Tirzepatide 20 complete / 50 below the minimum, Semaglutide 8 below. The 58 incomplete cases wait for the clinic's rule.
0b. [x] **The ordinal question is settled** (council of 2026-11-21, migration `20261121260000`): `visit_number` is the purchase ordinal, the 13 inherited gaps stay, no `visits` table, `create_sale` untouched. The 51 appointments are frozen in `docs/data/appointments-2026-11-21.json`; `AGENTS.md`, the column comment and the removal doc all say the same thing now.

1. [ ] **Data side** — the migration in [`../docs/appointments-removal-2026-11-21.md`](../docs/appointments-removal-2026-11-21.md) section 1: drop the two tables, two views, seven functions, `sales.appointment_id`, checks C14/C15/C17; renumber `visit_number` from the sales alone; add `treatments.sessions`; add the `package_split_cases` view; add the zero-value triggers and the check that joins them.
2. [ ] **Screens** (the owner): the agenda route, the show-up rate, the appointment picker in the sale screen, and `/api/ghl/appointments`.
3. [ ] **`AGENTS.md`**: the line "a visit with no purchase is an appointment with `show_up`" is no longer true.
4. [ ] **Waiting on the clinic**: sessions per item, the rule for extra and missing sessions, and what to do with the 51 historical appointments.

### UX, from the audit of 2026-11-20 (in the order it ranks them)

**The owner's list since 2026-11-21.** This session does not design or build screens; everything below is the owner's with another agent. It is kept here because the data questions behind a finding are still this session's to answer.

U1. [ ] **The dashboards and the sales report are not ours** — the owner builds them with another LLM. Offer the data contract if asked; do not build the screen.
U2. [x] **The expenses row must add up** — closed 2026-11-21: the month screen was rebuilt with KPI cards, so `Retained cash = Net rev − Total logged` and the returns term is named in the footer. The audit's example was **test data**: the 3.750,00 return it cited was created to exercise the returns flow on 2026-11-20 and deleted after, so `sale_refunds` and `adjustments` are both 0 today. One caveat: the `(−X ret.)` suffix only renders when a month has a return, so it has never been seen against the live base.
U3. [x] **Sales details** — closed 2026-11-21: a footer total of the filtered set (voided lines excluded), a real Status (Paid / Partial / Unpaid / Refunded / Voided, derived from `sale_money`), and every row opens `/sales/<id>`, a new sale page with its lines, plan, receipts and returns.
U4. [x] **Narrow screens** — closed 2026-11-21: the catalog hides Code, Cost and Margin below `sm` and prints cost and margin under the name, so the name never collapses (was 0 px at 390); the empty state sits outside the table; every table that still scrolls says so above it (`TableScrollHint`).
U5. [x] **Visible actions on empty worklists** — closed 2026-11-21: Returns offers "Find a patient's sales" (or "Clear the search"), Voids offers "Record a sale", Open Items offers "Record a sale on a plan", each next to the empty state instead of inside the scroll box.
U6. [x] **Lose nothing** — closed 2026-11-21: the sale in progress is kept in `sessionStorage` and restored with a "kept in this browser" notice and a Start over button, `beforeunload` warns once a line exists, and the two inline patient fields carry visible labels.
U7. [x] **Feedback** — closed 2026-11-21: `(app)/loading.tsx` (skeleton with an accessible status), `(app)/error.tsx` (written for the owner, Try again + dashboard) and `(app)/not-found.tsx` + `app/not-found.tsx`; the booking dialog prints its validation under the field, marks it `aria-invalid` and announces it with `role="alert"`.

1. [ ] **Six items still have no real cost** (owner data): Arum Life, Arum Vital, FemGuard and Perform Supplement carry the old estimate (57.40 / 57.40 / 35.00 / 35.00, migration `20261121160000`), PRP Microneedling and Regenerative Glow carry none. `set_item_cost` per item once the clinic gives the purchase cost. The other 20 product costs are set from the sheet and backdated.
2. [ ] **Confirm the 8 provisional prices**: Arum Life, Arum Vital, FemGuard, Perform Supplement, PRP Microneedling, Radiesse, Regenerative Glow, 4 IVs + 4 Lipotropic Package. They were added with the most repeated price in sales, and the sheet does not list any of them either, so the reconciliation could not confirm or correct them.
3. [ ] **Sales report** with the filters the owner defines.
4. [ ] **Branded PDF** of the patient report (logo, gold and navy per `docs/branding.md`).
5. [ ] Revoke the `sbp_` token in `.env.local` when the work pauses.
6. [ ] Deploy to Vercel once the sale screen is proven in the clinic.
7. [ ] **Google Calendar sync**, once the account access exists: read the secret iCal feed every few minutes (plus a manual **Sync**), create each booking as `external_ref = google:<uid>`, move a still-`booked` row when the event moves, cancel it when the event disappears, and map the event's service to the expected category. The GHL webhook stays dormant; one feeder, never two. Needs one real event first, to write the parser.
8. [ ] **Add `SUPABASE_PUBLISHABLE_KEY`** to `web/.env.local` (Project Settings → API keys), so the auth client stops falling back to the secret key.
9. [ ] **Decide the clinic account**: the email that signs in, whether Google sign-in follows, and who resets the password (today it is the Supabase dashboard, with no self-service screen).

### Catalog (owner decisions)

- [ ] **WAITING ON THE CLINIC — Monday 2026-11-23.** The owner reviews the catalog's shape with the clinic that day. Nothing on this side moves before that answer. The weight-loss check is written for that meeting: [`../docs/weight-loss-packages-check-2026-11-21.md`](../docs/weight-loss-packages-check-2026-11-21.md) — 70 Tirzepatide patients, 186 charges, 24 visits with no value, and the three questions the clinic has to answer.
- [ ] **Decide the 26 kind disagreements** the reconciliation found, one group at a time: nine packages stored as unit treatments, one membership as a unit, ten products the sheet calls Treatment, three services the sheet calls Treatment, three treatments the sheet calls Product. A kind is never rewritten to fix a past sale; the answer is either leave it or a new row of the right kind with the old one retired. Detail in [`../docs/catalog-reconciliation-2026-11-21.md`](../docs/catalog-reconciliation-2026-11-21.md) section 4.
- [ ] **Tirzepatide is the last package**: `PCK-0016` is active with 186 lines, and it is a package in name and in the sheet, so it stays. Nothing to decide here unless the clinic sells sessions one by one for it too.
- [ ] **Sessions**: only from the current month forward. `session_progress` and `session_gaps` report what happened; the 58 patients below the minimum in the imported past are information, not a queue.
- [x] ~~Restate the historical cost of the package lines~~ — decided 2026-11-21: the past stays as it is. No restatement.
- [ ] **What the current month must guarantee**: every visit that happens is recorded as a sale, no line at zero, no receipt at zero, and a program's sessions counted as they happen. This is the only month-level target from here.

### Owner data (not blockers)

- [ ] Average purchase cost per product; most products have none today.
- [ ] Confirm the 8 items added from sales with a provisional price.
- [ ] Confirm the two payment lines kept as services (`Payment completion…` 362, `Remaining Balance` 731).
- [ ] Confirm whether `Eterna IV Series Membership` becomes `unit_type = membership` (it is still a unit treatment, `TRT-0028`).

## Done on 2026-11-21

- [x] **Catalog reconciled against the owner's sheet** ([`../docs/catalog-reconciliation-2026-11-21.md`](../docs/catalog-reconciliation-2026-11-21.md)): 59 rows, 54 unique names, **0 price differences** and 19 cost differences, plus 26 rows where the sheet's kind disagrees with the base and 10 items the sheet does not list. `scripts/reconcile_catalog.py` reproduces it read-only.
- [x] **20 product costs set from the sheet and backdated to 2026-05-01** (migration `20261121150000`): the estimate and the $1.00 placeholder are gone, one open interval each. May–October margin +3.725,10, November −425,00, net **+3.300,10**; total gross margin 71.663,96 → 74.964,06. Checks and baseline green.

- [x] **Catalog integrity**: the three packages carry their total with `duration_months = 4` (PCK-0016 1980 / 490, PCK-0017 1000 / 244, PCK-0015 1512 / 195); the unit rows `TRT-0012` and `TRT-0037` were restored to their own values after a wrong attempt to price them as the package ÷ 4; 17 catalog prices were aligned to their intervals; and **C20** now fails if the catalog column and the open interval ever differ. 20 checks green.

- [x] **Customers normalized** (migrations `20261121070000` + `20261121080000`): 23 duplicate groups (26 rows) merged into one patient each, spellings moved to `aliases`, visits renumbered, every merge recorded in `customer_merges`. 215 → 189 customers with sales, lines and revenue unchanged (435 / 588 / 219.460,91). `resolve_customer` now resolves a recorded alias. The historical baseline was archived as `baseline-2026-11-20.json` and regenerated; `run_checks.py` green.
- [x] **Expenses classified, and the owner draw split** (migration `20261121050000`): `cost_behavior` and `guidance` on every concept; `Staff payroll` 2,880.00 + a new `Owner draw` 12,000.00 for May–Nov 2026 with a 0.00 delta, so the six closed months kept `status = 'closed'` and their exact totals (C18); the dashboard's fixed overhead now reads `cost_behavior = 'fixed'` instead of a slug list. The dialog shows the type, the category and the guidance, and a new concept now saves (the missing `normalized_name` trigger). `run_checks.py`, `pnpm typecheck` and `pnpm build` clean.

## Done on 2026-11-20

- [x] **More than one sale a day** (migrations `20261120140000`, `20261120140100`): the day index and the visit-number index are gone, a second sale shares the day's visit ordinal and is not a first visit, `visits` counts distinct days, and a first visit is only required to be visit 1 (not the other way round). Verified in a rollback: two sales on one day → visit 1 both, second not first, `visits = 1`; next day → visit 2, `visits = 2`. Cause of the phantom debt fixed too: `customer_balances` ignored `voided_at` in `next_due_on` and `is_overdue`.
- [ ] **`sale_number`** for a human invoice number (a `bigint identity` on `sales`, monotonic, gaps kept on void): the owner asked for a visible transaction id, and today a sale is a UUID.
- [ ] **A second sale from one booking is still blocked** by `sales_appointment_once`; decide whether an appointment can carry two invoices.

- [x] **Open Items** (`/open-items`): the money still expected — pending installments with amount, paid and remaining, grouped by due month, overdue and today flagged; the month header shows expected, overdue and received. `record_receipt(...)` (migration `20261120130200`) appends the evidence and lets the existing trigger cap it at what the installment still expects; cancelling an installment uses `void_payment` with a reason. Verified in a rollback (300 of 500 leaves 200, over-collection refused, the rest closes the item) and in the browser (the ledger with an overdue and a future installment; cancel removed the row). No receipt was written in the live base: receipts cannot be deleted, so the fixture was a plan with nothing collected and it was removed afterwards.

- [x] **Expenses module** (`/expenses`, `/expenses/<month>`): the seven imported months (six closed, November open) with the month total, the result after expenses and the category split; add or edit a line, void it with a reason, close and reopen with an audit row. Migration `20261120130000`: control columns on `expense_entries`, a partial unique index, `expense_period_changes`, four functions, and the three totals views now skip voided lines. Checks C18/C19 with controls (19 total).
- [x] **Returns & voids** (`/sales/returns`): record a return against a sale (cap = collected − returned), settle it, and list returns or voided sales; a void is offered only for a sale with no money. Migration `20261120130100`: the `sale_money` view. The UI flow was exercised end to end and the test return deleted; the void path was verified in a rollback (no sale in the base has `collected = 0`, so its button is disabled today by design).

- [x] **Vocabulary pass**: `createPatient` → `createCustomer` and its two searches; the Home card that read "Customers" now reads "Patients" and points at `/patients/report`; `/customers` survives only as a redirect. `lib/patients.ts` merged into `lib/customers.ts` — one reader of `customers_overview`, `Customer*` types, the pages still say patient. Fixed `patientId: patient?.id ?? ""`, which fabricated an empty id on a failed join. Check: 8 routes render zero occurrences of "customer"; `tsc` clean.
- [x] **Appointments screen** (`/appointments`): Agenda (every `booked`, ascending, `Today` and `Late` badges, day groups, `Via: Bot | Desk`), History (`Day | Range`, 20 per page, outcome and reason), New booking (patient search-or-create, calendar + 15-minute slots, category, source), and one row of actions (Show up / No-show / Cancel with reason / Reschedule with reason). Migration `20261120120100`: `appointments.external_ref` (unique), `ghl_calendar_map`, `book_appointment_external(...)`. `/api/ghl/appointments` receives the bot's booking behind `x-ghl-secret`, idempotent on `ghl:<id>` — built, then left dormant in favour of the Google Calendar feed (see Blockers). Verified with Playwright (book, resolve, cancel, reschedule refused into the past, stale second tab) and with rollbacks for the function; `tsc` and `next build` clean; base back to 51 appointments / 215 customers.
- [x] **Sale entry screen** (`/sales/new`): patient search or create, dynamic catalog lines (quantity locked on packages/memberships), payment plan with receipts and a "collected in full now" shortcut, optional appointment link, notes. One Postgres function `create_sale(...)` (migrations `20261120110000` + `20261120110001`) and one server action; exercised inside a rollback (first visit and repeat visit), then `run_checks.py` (17 checks, controls and baseline all green). `tsc --noEmit` and `next build` clean.
- [x] **UI pass**: catalog search, Memberships tab, Margin reference column and a fixed-width grid consistent across tabs; `Day | Range | All` date filter shared by Sales details (default today) and Patient report (default All, searchable directory); 20-row pagination on both; Patient detail shows real item names and hides empty Appointments.

## Done on 2026-11-19

- [x] UI scaffold in `web/`: Next.js 16.4.5, shadcn/ui (Base UI, nova), collapsible sidebar with the logo placeholder, one route per module, light theme by default. Typecheck and production build pass.

- [x] Baseline committed: `docs/data/baseline.json` with the 432 sales, six counts, 219.492,91 sold and collected, and a per-sale salted hash. `run_checks.py` compares it after every batch; `write_baseline.py` refuses to overwrite without `--force`.
- [x] Appointments module: `appointments`, `appointment_changes`, `sales.appointment_id`, `resolve_customer`, the funnel and conversion views, and checks C14–C17.

- [x] Schema applied: 18 tables, 15 views, seeds for categories, sources, payment methods, treatments, products, services.
- [x] Import: 188 customers, 470 sales, 626 items, 470 payments, revenue 219.492,91, everything reconciled.
- [x] 11 duplicate customer groups merged after the owner confirmed them.
- [x] 13 product bundles re-imported with their real quantities; the missing Arum line recovered.
- [x] 3 rows with a `Total` but no unit price registered using the total.
- [x] Expenses: 7 monthly periods, 9 categories, 23 suppliers, 19 concepts.
- [x] Discount per sale line (`list_price`, `discount`), cost snapshot (`unit_cost`, `line_margin`) and cost history (`item_cost_history`).
- [x] Packages: `unit_type`, quantity always 1 enforced by trigger, free-text description.
- [x] `customer_balances` rebuilt over `sold − paid`: sold, paid, balance, visits, last visit, next due date. 176 customers with money, 2 with no sale at all, 10 with a zero-value visit, all balances zero and reconciled against 219.492,91.
- [x] Data access closed: no grants for `anon`/`authenticated`, all 15 views `security_invoker`, RLS on with zero policies. The publishable key now gets `401` on every table and view.
- [x] First git commit (221 files). Patient-level sources (workbook, customer CSVs, identity notes) are gitignored.
- [x] `apply_migrations.py` made incremental with a `public.schema_migrations` ledger; it stops on the first error and re-applies the access lock-down as an invariant after every batch.
