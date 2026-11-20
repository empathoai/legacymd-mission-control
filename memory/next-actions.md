# Next Actions

Punch list. One line per action, imperative, with the owner when it is not me. At session close, finished items are summarised in [`session-summaries.md`](session-summaries.md) and removed from here.

## Blockers

- **Access to the clinic's Google account.** The bot writes the bookings to the clinic's Google Calendar, so the calendar's *secret address in iCal format* is the intended feeder for `/appointments`. Nobody has that address until the owner grants access to the account. Nothing else about the integration can be built before it: the event sample (title, description, location) comes from that account too.

## Next

### UX, from the audit of 2026-11-20 (in the order it ranks them)

U1. [ ] **The dashboards and the sales report are not ours** — the owner builds them with another LLM. Offer the data contract if asked; do not build the screen.
U2. [ ] **The expenses row must add up**: show returns in the row (or net revenue) so `Left` can be reproduced with a calculator.
U3. [ ] **Sales details**: a footer total, a real Status (paid / partial / refunded / voided), and a row that opens.
U4. [ ] **Narrow screens**: the catalog's Name column must never collapse to zero, money columns must be visible without an unmarked inner scroll, and an in-table empty state goes outside the scroll box.
U5. [ ] **Visible actions on Returns, Voids and Open Items** when the list is empty, instead of an empty state that points at a search that leads nowhere.
U6. [ ] **Lose nothing**: warn before leaving an unsaved sale, label the two inline patient fields, stop discarding the draft.
U7. [ ] **Feedback**: a shared route loading state, an error and not-found screen written for the owner, and field-level validation as an alert.

1. [ ] **Product costs**: 24 products have no cost. Owner to give the averages; `set_item_cost` per product.
2. [ ] **Confirm the 8 provisional prices**: Arum Life, Arum Vital, FemGuard, Perform Supplement, PRP Microneedling, Radiesse, Regenerative Glow, 4 IVs + 4 Lipotropic Package. They were added with the most repeated price in sales.
3. [ ] **Sales report** with the filters the owner defines.
4. [ ] **Branded PDF** of the patient report (logo, gold and navy per `docs/branding.md`).
5. [ ] Revoke the `sbp_` token in `.env.local` when the work pauses.
6. [ ] Deploy to Vercel once the sale screen is proven in the clinic.
7. [ ] **Google Calendar sync**, once the account access exists: read the secret iCal feed every few minutes (plus a manual **Sync**), create each booking as `external_ref = google:<uid>`, move a still-`booked` row when the event moves, cancel it when the event disappears, and map the event's service to the expected category. The GHL webhook stays dormant; one feeder, never two. Needs one real event first, to write the parser.
8. [ ] **Add `SUPABASE_PUBLISHABLE_KEY`** to `web/.env.local` (Project Settings → API keys), so the auth client stops falling back to the secret key.
9. [ ] **Decide the clinic account**: the email that signs in, whether Google sign-in follows, and who resets the password (today it is the Supabase dashboard, with no self-service screen).

### Owner data (not blockers)

- [ ] Average purchase cost per product; most products have none today.
- [ ] Confirm the 8 items added from sales with a provisional price.
- [ ] Confirm the two payment lines kept as services (`Payment completion…` 362, `Remaining Balance` 731).
- [ ] Confirm whether `Eterna IV Series Membership` becomes `unit_type = membership` (it is still a unit treatment, `TRT-0028`).

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
