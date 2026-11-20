# Session Summaries

Dated session wrap-ups, newest first. Format: what was attempted, what got done, what stayed open.

## 2026-11-20 — UX audit, and the first three fixes

**Goal:** stop guessing the interface. Audit every screen with fresh eyes, against a real rule set, and fix what the audit ranks first.

**Done:**
- Installed the `ui-ux-pro-max` skill in `.agents/skills/` (80 files; its search script runs with `py`), and ran it through a context-free auditor: 17 routes at 1440 and 390, every dialog, 70 screenshots, read-only. The report is [`docs/ux-audit-2026-11-20.md`](../docs/ux-audit-2026-11-20.md).
- Its verdict: not shippable yet, because the dashboard said the modules were not built while they were.
- Fixed the three it ranks first: the dashboard shows the month's real sold, collected, owed and show-up rate (and no "Mission Control" or "Prototype"); the sale screen pins the total and **Record sale** in a sticky bar, with one total instead of two; the catalog picker shows a kind badge and the price on every row, ranks priced items first, and takes arrow keys and Enter.
- Verified signed in (a throwaway user through the Admin API, deleted in the same run): dashboard `$18,600 / $18,600 / $0 / 100%`, the picker shows `Membership $2,220` above `Treatment $600`, Enter adds the highlighted one, and the button sits at y=897 in a 950 viewport before and after scrolling.

**Open:** audit items U2-U7, listed in [`next-actions.md`](next-actions.md). **Handed over:** the dashboards and the sales report are the owner's, built in another session with another LLM (see [`decisions.md`](decisions.md)); this side keeps the base, the checks and the entry screens.

**State at close:** `master` clean at `c2e59c1`, no remote — nothing is pushed. 435 sales, November `18.599,92` sold and collected, 92 migrations applied, 19 checks green, `tsc`, build and `check_copy.py` clean.

## 2026-11-20 — Login

**Goal:** put the `login-01` block in and make it the gate, not a picture: the clinic account signs in with email and password, every screen sits behind it, and each write records who did it.

**Done:**
- `/login` renders on its own — the routed screens moved under `web/app/(app)/`, so the sidebar shell no longer wraps it — with the brand mark, email, password and one message for a wrong password or an unknown email.
- Session in cookies through `@supabase/ssr`; `web/proxy.ts` verifies with `auth.getClaims()` on every request, sends a signed-out visitor to `/login?next=…` and a signed-in one away from `/login`. Sign out sits in the sidebar footer, which also shows the signed-in email.
- Every write takes its actor from the session (`lib/auth.ts`, `actor()`) instead of the fixed `front-desk`: sales, receipts, expenses, returns and appointments.
- Verified with Playwright against a throwaway `qa-login@legacymd.test` (created through the Admin API, deleted in the same run): the gate redirects with `next`, a wrong password shows the message, the right one lands on the requested page, the sidebar shows the email, `/login` while signed in goes to `/`, Sign out returns to `/login` and `/` is refused again. No console errors; 390 px and both themes read back. `tsc` and eslint clean, `check_copy.py` neutral.

**Open:** the project has no publishable key, so the auth client falls back to the server-only `SUPABASE_SECRET_KEY` (it never reaches the browser). Add `SUPABASE_PUBLISHABLE_KEY` to drop the fallback. Google sign-in is not wired, and a password reset happens in the Supabase dashboard — there is no self-service screen. The write paths were typechecked, not re-run against the base after the actor swap.

## 2026-11-20 — Expenses checked against the sheet

**Goal:** the owner extracted the workbook's expense block into `Expenses por mes.xlsx` (7 months, 105 rows, with a "Total registrado" column) and asked whether it matched the base.

**Done:**
- The extraction is a faithful copy of the block — every source row, blank cells included — and its totals reproduce the sheet's own `Total Expenses`. Against the base, 5 of 7 months matched to the cent and exactly two lines differed.
- **July:** the import's sweep read past `Total Expenses` and counted `DERMA M 1.200` (R45, below the total, noted "Derma M: $1200"). Reopened with a reason, voided with a reason, closed again: 34.203,10 → **33.003,10**, 11 live lines + 1 voided.
- **November:** the sheet says `Products 3.667,00`; the base carried 3.265,34 from the audited copy. Corrected through `set_expense_entry` (November is open): 29.963,67 → **30.365,33**.
- The two corrections were applied inside one transaction each, guarded on state (the one-shot scripts were removed with the import). Verified: the live base now equals the extraction line by line (98 lines, 247.350,49), `expense_by_category` sums to the same totals, the July audit shows the reopen and the reclose, 19 checks green, baseline holds at 435 sales.
- **Test fixture removed at the owner's request.** The returns/voids UI pass had left a customer literally named `test` with 3 sales (2.220,00 / 765,00 / 765,00), one payment, one receipt and one return each, created 12:54–13:17. Receipts are immutable by design, so the delete lifted `payment_receipts_immutable` for one transaction and removed them in FK order (receipts → payment changes → refunds → payments → items → sale → customer); the guard is back on (`tgenabled = O`). Base back to **435 sales / 588 items / 435 receipts / 0 returns / 215 customers**, 19 checks green, baseline holds.

**Open:** the extraction workbook stays outside the repository; the July reopen left the permanent audit row by design. The app's screens were mid-refactor under `web/app/(app)/` while this ran, so the change was verified against the database and the checks, not in the browser.

## 2026-11-20 — Open Items

**Goal:** see the money still expected this month, record what the owner collects, cancel what will not happen. No Stripe, no integration — an open ledger.

**Done:**
- **`/open-items`**: every pending installment with its amount, what is paid and what remains, grouped by due month, with `Overdue` and `Today` badges; three cards (expected this month, overdue, received this month).
- **`record_receipt(...)`** (migration `20261120130200`): the missing writer. It appends the receipt, never edits the installment or the sale, and leaves the cap to the existing `receipt_within_expected` trigger. **Cancel** uses `void_payment` with a reason.
- Verified in a rollback (300 of 500 leaves 200 expected; an over-collection is refused; the remaining 200 closes the item and it leaves the forecast) and in the browser (ledger with one overdue and one future installment, the payment dialog prefilled with the maximum, and cancel removing the row). The fixture was a plan with nothing collected, deleted afterwards: **receipts cannot be deleted**, so no test receipt was ever written to the real base. 19 checks green, baseline holds, base back to 435 sales / 435 installments / 435 receipts.

**Open:** the 435 imported sales never used a plan (all created on the import day), so Open Items is empty until the first real plan is sold; the dashboard metrics and the sales report are still placeholders.

## 2026-11-20 — Expenses and returns/voids

**Goal:** two modules the app was missing, on the schema that already existed: the expense month as a closed snapshot with its logic, and returns plus voids.

**Done:**
- **Expenses** (`/expenses`, `/expenses/<month>`): the seven imported months (six closed May–October, November open), each with its stored total, the result after expenses and the category split; add or correct a line, void it with a reason, close and reopen with an audit row. Migration `20261120130000`: `created_by`/`updated_by`/void columns on `expense_entries`, a partial unique index (one live line per item and supplier), `expense_period_changes`, and five functions — `start_expense_month`, `set_expense_entry`, `void_expense_entry`, `close_expense_period`, `reopen_expense_period`. `expense_by_category`, `monthly_pl` and `monthly_balance` now skip voided lines. Checks **C18** (closed total) and **C19** (views skip voided), each with a control; 19 green.
- **Returns & voids** (`/sales/returns`): a three-step dialog — patient, her sales, then the form — records a return against a sale (amount capped by collected − returned), a settle dialog marks it refunded, and a second tab lists voided sales. A void is offered only when the sale has no receipts and no returns. Migration `20261120130100` adds `sale_money` (sold, collected, returned, balance per sale).
- Verified: every function in a rollback (upsert, void, void twice, close, close twice, reopen, write into a closed month, the bad period), the void rules in a rollback (unpaid voids, twice refused, paid refused), and the return flow in the browser end to end — the test return and its settled state were deleted afterwards. Then the expense write path through the **browser**: add $1.23, edit to $2.00, void, and the total moved exactly +1.23, +0.77, −2.00 back to 29.963,67. That pass found a real bug: adding an item the month already had silently replaced its amount; the dialog now loads the line and warns. `tsc` and `next build` clean; base unchanged: 435 sales, 215 patients, 51 appointments, 0 returns, 99 expense entries.

**Open:** no sale has `collected = 0`, so the Void button is disabled everywhere in today's base; the returns list is not paginated; a reopened month leaves a permanent audit row.

**Next:** the sales report, product costs, the branded PDF, the deploy and the Google Calendar access.

## 2026-11-20 — Appointments agenda and the bot's intake

**Goal:** wake up `/appointments`, which was a placeholder over a finished schema: book at the desk, see who is coming, mark the outcome, and let the bot's GoHighLevel bookings land here.

**Done:**
- **Agenda**: every `booked` booking, ascending, no date window; `Today` and `Late` badges; grouped by clinic day; a `Via: Bot | Desk` badge; row actions **Show up / No-show / Cancel** (required reason) **/ Reschedule** (required reason, audited). **History**: resolved bookings with `Day | Range` (default today), outcome, reason and 20 rows per page. A patient search on both tabs, through the same accent-insensitive normaliser the rest of the app uses.
- **New booking**: patient search-or-create, a calendar plus 15-minute slots (08:00–19:00), expected category and source. The wall time is turned into the clinic instant by `clinicWallToUtcIso`, checked against Tokyo's clock and against both DST sides.
- **Migration `20261120120100`**: `appointments.external_ref` (unique, null for the desk), `ghl_calendar_map` (calendar → category + default source, RLS on), and `book_appointment_external(...)`, idempotent on the reference.
- **`/api/ghl/appointments`**: `x-ghl-secret` required (`GHL_WEBHOOK_SECRET`), tolerant parse of the flat or nested delivery, the map read before the customer is resolved, `422` naming an unmapped calendar, `200` with the same id on a retry.
- Verified with Playwright in dark: booked, marked no-show, saw it leave the agenda and appear in History, cancelled, and a reschedule into the past refused with a readable message; the stale second tab got "Another tab already marked this booking." Rollbacks for the functions (retry returns the same id; a null ref never collides; resolved and past moves refused). `tsc` and `next build` clean. Test rows removed: back to 51 appointments, 215 customers.
- Found and fixed a pre-existing `500`: a stale `?page=` past the last row made Sales details, Patient report and the new History fail with PostgREST `416`. `web/lib/pagination.ts` now counts first and clamps the page; `?page=99` answers `200` on all three.
- **Vocabulary**: `createPatient` → `createCustomer` (and `searchSaleCustomers`, `AppointmentCustomer`); the Home card that read "Customers" reads "Patients"; `lib/patients.ts` merged into `lib/customers.ts` (one reader of `customers_overview`, `Customer*` types, pages still say patient); fixed `patientId: patient?.id ?? ""`, which manufactured an empty id on a failed join. Check: eight routes render zero occurrences of "customer".

**Open:** `ghl_calendar_map` is empty until the owner sends the calendar ids, so the intake refuses every delivery; the webhook needs a public URL, which means the Vercel deploy (or a tunnel). GHL never sends moves or cancellations.

**Decided the same day:** the bot writes to the clinic's **Google Calendar**, so that calendar's secret iCal feed becomes the single feeder (`external_ref = google:<uid>`, moves and cancellations included) and the GHL webhook stays dormant. Blocked on access to the clinic's Google account, which nobody has yet; the parser also needs one real event (title, description, location) from that account.

**Next:** product costs, the sales report, the branded PDF, the deploy.

## 2026-11-20 — UI pass (catalog, filters, pagination)

**Goal:** iterate the UI against the owner's review: catalog search and memberships, date filters, pagination and consistency.

**Done:**
- Catalog: 5th tab **Memberships** (`unit_type = membership`), **search** by name/code, **Margin** reference column (`price − cost` + %, `—` when unknown) and the column order **Cost → Price → Margin**; the edit pencil sits next to Status; the grid is a fixed `max-w-5xl` `table-fixed` column, the same width on every tab, with search and the New button aligned to it.
- Sales details: shared `Day | Range` date filter, default today; 20 rows per page.
- Patient report: defaults to **All** (searchable directory) with optional `Day | Range`, 20 rows per page; period view shows patients with sales in the period (Spent/Returns/Visits period, Balance/Next due lifetime).
- Patient detail: "Details" column shows real item names (from `sale_lines.item_name`); Appointments hidden when empty.
- Sale entry payment UX: "Paid in full" vs "Partial or installments", compact amounts, official shadcn/Base UI `Select` (dark popup), no native `<select>` left.
- Verified every change with Playwright in dark; `tsc` clean.

**Open:** product costs still the $1.00 placeholder (catalog margin ~98% for products); only one membership exists; the Eterna membership is misclassified.

**Next:** product costs, sales report, branded PDF.

## 2026-11-20 — sale entry screen

**Goal:** build the sale entry screen on the recorded logic — patient, catalog lines, payment plan, optional appointment — via one `create_sale(...)` function and one server action.

**Done:**
- `create_sale(...)` (migrations `20261120110000` + `20261120110001`): the single writer of a live sale. Derives `visit_number` and `is_first_visit`, requires a source on the first visit, refuses a second sale for the same patient on the same day, freezes `list_price` from the price list on the business day (item price as fallback), and writes the sale, lines, plan and receipts atomically. The plan must equal the sale total.
- Exercised inside a rollback: first visit (visit 1, source kept) and repeat visit (visit 2, source ignored, partial collection); `list_price` matched `price_on`, the plan equalled sold. All 17 checks, their controls and the baseline stay green.
- Web layer: `web/lib/sale-entry.ts` (items/sources/methods), `web/app/sales/actions.ts` (createSale, patient search, booked appointments), `web/app/sales/new/page.tsx`, `web/components/sale-form.tsx` (patient search-or-create, dynamic lines with quantity locked on packages/memberships, payment plan with receipts and a "collected in full now" shortcut, optional appointment link, notes). Nav entry and header title added.
- `tsc --noEmit` clean; `next build` clean (route `/sales/new` registered); `/sales/new` returns 200 and renders without error.

**Open:** the actor is the fixed `front-desk` until login exists; a full interactive browser pass (screenshot at 1440×900) is the one remaining UI check.

**Next:** product costs, the sales report, the branded PDF.

## 2026-11-20 — consolidated base and catalog

**Goal:** replace the historical base with the owner's consolidated workbook and settle the catalog.

**Done:**
- Read `docs/Ingresos consolidados - Consolidado.csv` (553 rows, 216 names) and `customers.csv`. One row per sale, with a service slot and a product slot; 51 patient+date groups repeat across rows.
- Imported: 215 customers, 486 visits (435 sales, 51 appointments), 588 lines, 219.460,91. `sales.visit_number` stores the clinic ordinal (1 = first visit); two spellings of one patient merged and renumbered.
- Catalog rebuilt from `docs/catalog.csv` (56 items) plus 8 items that only existed in the sales file, added with the most repeated price. 66 active: 35 treatments (31 unit, 3 package, 1 membership), 26 products, 5 services.
- Membership became a third `unit_type` with its own `MEM-` series; the taxonomy is written in `docs/catalog-taxonomy.md`.
- Old review tables cleared (`import_review`, `customer_merge_candidates`), generated files from the previous import deleted, previous baseline archived as `baseline-2026-11-19.json`.
- Earlier the same night: 10 sale lines were deleted and 3 repointed to a new service while chasing a zero-price line. Restored line by line, baseline back to its digest, and the immutability rule written into `AGENTS.md`.

**Open:** product costs missing for most products; the 8 added items carry a provisional price from sales; the branded PDF.

**Next:** sale entry screen.

## 2026-11-19 — second session (resume)

**Goal:** resume from the handoff and close the two blockers before any UI work.

**Done:**
- Workspace was unreadable for the sandbox (`WRITE_OWNER` missing on the project folder); repaired with the ACL skill and verified.
- `customer_balances` rebuilt (`20261119092700`): `sold − paid` balance, `sold_total`, `visits`, `last_visit_on`. Totals reconcile to 219.492,91 on both sides.
- Data access closed (`20261119092800`): grants revoked for `anon`/`authenticated`, 15 views set to `security_invoker`, RLS left on with zero policies. Live check: publishable key 401, secret key 200.
- First git commit `4f3aa38`, 221 files, with `.gitattributes` (LF) and patient-level sources gitignored.
- Migration runner fixed: `apply_migrations.py` now records applied files in `public.schema_migrations`, stops on the first error, and re-applies the lock-down file after every batch. The old "re-runs every file" behaviour failed on `091000` and would have wiped the 99 expense entries on `091400`.
- Memory, handoff and AGENTS updated with the access decision and the new numbers.

**Open:**
- Two workbook comments say money was still owed (Monica Reviglio $100, Maria Elena Cabrera $82) but the import records both sales as paid.
- `adjustments` still does not exist; product costs still $1.00; no UI.

**Next:** ask the owner about those two amounts, then build the sale entry screen.

## 2026-11-19

**Goal:** stand up the data layer for a med spa sales app that replaces a workbook.

**Done:**
- Skills installed in `.agents/skills` (shadcn, superpowers, supabase, supabase-server, llm-council) and globally (`grill-me`, `grilling`, `writing-for-agents`).
- Supabase project validated; test user created and login verified (ES256 JWT).
- 24 migrations applied: catalogs, sales, items, payments, expenses, analytics views.
- Workbook imported and reconciled: 188 customers, 470 sales, 626 items, 470 payments, revenue 219.492,91.
- Customer dedupe: 236 spellings → 188 people; 11 groups merged after the owner confirmed them.
- 13 product bundles and 3 rows with a total but no unit price recovered; zero lines with a value left outside the database.
- Expenses modelled as masters (categories, suppliers, concepts) with monthly snapshots; May–Oct closed, November open.
- Sale lines now freeze `unit_cost`, `list_price`, `line_margin` and `discount`, with a cost history per catalog item.
- Packages split from unit treatments (`unit_type`), quantity always 1 enforced by trigger, free-text description.

**Open:**
- `customer_balances` still reports everyone as settled.
- RLS has no policies and the views are `SECURITY DEFINER` (publishable key can read everything).
- No `adjustments` yet, so refunds and no-shows are outside the balance.
- Product costs are a $1 placeholder until the owner provides the real averages.
- No UI, no git repository, token still active.

**Next:** fix balances and access, then build the sale entry screen.
