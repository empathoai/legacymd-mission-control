# Decisions

One line per decision: `Date · what · why`. Newest first. Long-form reasoning lives under **Long-form**, linked by number (`D1`, `D2`, …).

## Log

- 2026-11-21 — **Appointments leave the system; the tool records new clients and new sales only.** Legacy MD does not log no-shows: the clinic writes down the patients who arrive, and the diary lives outside. So the agenda, the show-up rate, the funnel and the conversion views have no data behind them, and a booking module would be a second bookkeeping the desk never asked for. What follows: no show rate anywhere, no `sales.appointment_id`, no GHL webhook, and **a visit is a day with a sale** — a day with no sale is not a record. The 51 imported appointments become history with no reader; the visit ordinals they explained (11 patients whose numbering skips a day) have to be renumbered from the sales alone. The data side is this session's; the screens are the owner's. Detail of what changes: [`../docs/appointments-removal-2026-11-21.md`](../docs/appointments-removal-2026-11-21.md).

- 2026-11-21 — **The name decides, and Semaglutide is a package.** The item is called "Weight Loss Package w/ Semaglutide" and the master's Category column says Package, so the unit row wearing the word was the inconsistency. Migration `20261121230000` brings `PCK-0015` back as the live row and retires `TRT-0037`; its 13 historical lines stay on the retired row, which still resolves. Price and cost are identical on both, so no money moves. Timmix stays a unit — its name carries no "Package" and the owner asked for it.

- 2026-11-21 — **Timmix and Semaglutide sell as unit treatments.** The owner's call. Both already had their history on the unit row (`TRT-0012` 32 lines at 250, `TRT-0037` 13 lines at 1.512) while the package twins carried none, so migration `20261121220000` makes the unit the live row and retires `PCK-0017`. It fits the session logic: a patient takes as many sessions as progress asks, and each one is a line. Tirzepatide keeps its package (`PCK-0016`, 186 lines) because the owner has not asked for it, and `TRT-0037` keeps the word "Package" in its name — the sheet's name for it — until the clinic renames it.

- 2026-11-21 — **A package's number is sessions, and the catalog does not own it.** The owner settled it: those are sessions, not months, and they are not fixed — a patient can take 12, or fewer, depending on progress. So the count belongs to the patient's plan, not to the item, and a default on `treatments` can only be wrong for someone. Migration `20261121210000` drops `duration_months`: no view, no function and no screen read it, and the four values it held came from the installment arithmetic (1980 ÷ 495), not from counting sessions. Nothing about money moves — the forecast reads `sale_payments.due_on` and `payment_receipts`. If the desk wants to track sessions left, that is a field on the plan or the sale, designed with the clinic; the column can come back as that, not as a catalog default.

- 2026-11-21 — **Regenerative Glow sells as a package.** The owner's call, and the data agreed: `PCK-0012` already held the only sale (1.357,50 on 2026-05-11), the price and a cost of 950.25, while the unit row `TRT-0035` held neither a sale nor a cost. Migration `20261121190000` makes the package active and retires the unit with `active = false` — never a delete, so the code and the history stay. Its duration was set to one month the same day and then dropped with the column: sessions belong to the patient's plan.

- 2026-11-21 — **A patient's name never enters the catalog.** `Regenerative Glow Protocol for Annette` was registered, and sold, with the patient inside the item name — so the item could not be sold to anyone else without looking wrong. Both rows are now `Regenerative Glow Protocol` (migrations `20261121170000`, `20261121180000`). The history moved with it: `sale_lines.item_name` reads the catalog live, so the 2026-05-11 line that carries the patient's name now reads the clean one. A rename is not a rewrite: no sale, amount or line changed. What is not fixed by a rename is that the only sale sits on the inactive package and the active row has none — that pair waits for the clinic with the other two.

- 2026-11-21 — **The $1.00 placeholder is gone from every active product, and no new number was invented to replace it.** The four products the sheet does not list had a real estimate until 2026-11-01, when the cutover overwrote it with the placeholder. Migration `20261121160000` deletes the placeholder interval and reopens the estimate — 57.40 / 57.40 / 35.00 / 35.00 — so those items read a 30% margin instead of 98%. Why the estimate instead of leaving the cost empty: `C05` requires every sale line after the cutover to resolve to a cost, so an empty interval would fail the next sale of that item, and an invented purchase cost is exactly what the base must not carry. November margin falls 90,40 (6.681,22 → 6.590,82); the real cost still waits on the clinic.

- 2026-11-21 — **UI/UX is off-limits to this session.** The owner builds every screen with another agent: routes, layout, components, copy, dialogs, styling and the UX backlog. This session keeps the base, the migrations, the checks, the data contracts and the server actions, and answers questions. Set by the owner after the desk-screen pass of the same day: the split is not about who can edit a file, it is about one hand drawing the interface. When a data change needs a screen change, the work stops at the data and the screen is handed over. Recorded in `AGENTS.md` as a non-negotiable.

- 2026-11-21 — **A sale in progress lives in the browser, not in the base.** The entry screen keeps its draft in `sessionStorage` (12-hour window, one tab), restores it with a "kept in this browser" notice and a Start over button, warns with `beforeunload` once a line exists, and clears the key when the sale is written. Why not a database draft: an unfinished sale is not a record, and a `draft` state in `sales` would put rows in the base that no report should count. The cost of the choice: another tab or another device does not see the draft, which is the right unit here — the desk types it in one place.
- 2026-11-21 — **A sale has a page.** `/sales/<id>` reads `sale_money`, the lines, the plan with its receipts and any return; the row in Sales details opens it. Why: the audit could not get from a line to "what happened to this sale", and a status without a way to check it is a label nobody trusts.
- 2026-11-21 — **A table that scrolls says so.** Below `sm` the horizontal scroll inside a bordered table is invisible, so `TableScrollHint` prints "Swipe the table sideways" above it, and the catalog drops Code, Cost and Margin to print cost and margin under the name instead. Why: the audit measured the catalog Name column at 0 px at 390 — an identifier that is not there is not a layout preference.

- 2026-11-21 — **The catalog sheet is the master for price and cost, and its cost applies to the whole history.** Migration `20261121150000` set the real average cost of 20 products from 2026-05-01, replacing two numbers the base had invented: an estimate at 70–130% of the price from the cutover, and a $1.00 placeholder from 2026-11-01. The owner asked for the history to be updated rather than only the future, so May–October margin rises by 3.725,10 and November falls by 425,00 — the estimate had been charging more than the real cost, and November had been charging one dollar. Revenue, cash and the closed expense months do not move: a margin is derived from the interval that covers the day, so nothing writes to a sale. The four products the sheet does not list (Arum Life, Arum Vital, FemGuard, Perform Supplement) keep the placeholder, and that is now the only fiction left in the catalog.
- 2026-11-21 — **A reconciliation against the owner's sheet is a script, not a one-off query.** `scripts/reconcile_catalog.py` takes the sheet, matches by normalized name, and prints only what differs: price, cost, kind, rows in one side only. It is read-only, so it runs again after every sheet the owner sends; the report it produced is [`../docs/catalog-reconciliation-2026-11-21.md`](../docs/catalog-reconciliation-2026-11-21.md). Prices agreed on 54 of 54 rows, which is the evidence that the 2026-11-21 alignment held.
- 2026-11-21 — **A kind disagreement is a decision, not a fix.** The sheet calls 26 rows something other than what the base stores (packages as unit treatments, products as treatments, services as treatments). A kind cannot be rewritten to fix a past sale — `sale_items` points at the row by kind — so each group either stays or gets a new row of the right kind for future sales, with the old one retired. Not done yet: it needs the owner, group by group.
- 2026-11-20 — **The login gate is off in development and on in production.** `web/proxy.ts` returns before the auth check when `NODE_ENV !== "production"`, and `lib/auth.ts` hands a write the actor `dev@local` instead of redirecting to `/login`. The reason is not convenience: the owner has to be able to open the app to review a dashboard, and another agent has to review one without holding the clinic password. Nothing changes for a build — `next build && next start` is gated, and the clinic account is the only one in the project.
- 2026-11-20 — **The dashboards and the sales report are the owner's, built with another LLM.** This session stops at the data contract — the views (`monthly_pl`, `cash_collected`, `monthly_money`, `sale_money`, `refunded_by_item`) and the entry screens — and answers what the other model asks. Two models drawing the same reporting surface would only fight; the owner's taste decides it. What remains here is the audit's U2–U7: the screens used at the desk, not the reporting surface.
- 2026-11-20 — **Login is one clinic account with email and password, and the app is gated by it.** The session lives in cookies (`@supabase/ssr`) and `web/proxy.ts` verifies it with `auth.getClaims()` — never `getSession`, which trusts the cookie — on every request; a signed-out visitor goes to `/login?next=…` so the screen opens where it was going. The login form gives the same message for a wrong password and an unknown email, because the screen must not reveal which accounts exist. Google sign-in stays out until there is a Google OAuth client; a reset happens in the Supabase dashboard.
- 2026-11-20 — **The actor is the signed-in email, not `front-desk`.** `lib/auth.ts` reads it from the verified claims, and every write passes it to its function (`p_by`). One staff account still means one name; the point is that the name comes from the session instead of a constant, so the audit trail starts when a second account does.
- 2026-11-20 — **The routed screens live under `web/app/(app)/`.** A route group keeps `/login` out of the sidebar shell without a URL change; the colocated action modules are imported as `@/app/(app)/<route>/actions`.
- 2026-11-20 — **A line below the sheet's `Total Expenses` is not part of that month.** July keeps `DERMA M 1.200` under the total and outside its formula, and the import's sweep past that row counted it: July read 34.203,10 against the sheet's 33.003,10. The line is voided with a reason (the month was reopened and closed again, both in `expense_period_changes`) and July now stores 33.003,10. November's `Products` was 3.265,34 from the audited copy against 3.667,00 in the sheet; the sheet wins, corrected through `set_expense_entry`. The base now equals the extraction to the cent: **247.350,49**, 98 live lines.
- 2026-11-20 — **Returns and Voids are two sections, not one screen with filters.** A return operates on a sale with money collected; a void operates on a sale with none. They are different transactions, so each has its own page with the documents it can act on: no date pickers, no state tabs — the list is today, and a patient search reaches back. The history of each sits under its worklist.
- 2026-11-20 — **A patient may buy more than once a day.** The business day is the visit: a second sale that day shares the visit ordinal and is not a first visit, and `visits` counts distinct days. One sale per day was the imported workbook's shape, not the clinic's, and it blocked a real sale with no way out. A correction is still **append**: void + new, never delete, never rewrite; a sale with money is corrected with a **return**, not a void, and a sale id is never reused.
- 2026-11-20 — **Copy is neutral.** No she, no he, no her, no his in any string the interface shows — placeholders and empty states included. `scripts/check_copy.py` scans `web/` and fails on one, because remembering it has already failed twice.
- 2026-11-20 — **Open Items** is the name of the module that shows the money still expected: installments pending with their remaining balance, grouped by due month, overdue flagged. A payment is *recorded* (`record_receipt`, appended, never edits the installment) and a charge that will not happen is *cancelled* (`void_payment`, with a reason). The forecast is read, never stored.
- 2026-11-20 — Expenses are a sheet, not a ledger: one line per expense item and supplier in a month. `set_expense_entry` upserts it, `void_expense_entry` retires it with a reason and stops counting, `close_expense_period` stores the total, and `reopen_expense_period` needs a reason and writes `expense_period_changes`. A closed month refuses every write, including the void.
- 2026-11-20 — A return points at the sale and never edits it: `register_return` is born pending (the clinic owes it, the balance shows the credit), `settle_return` only moves the state, and a void is only for a sale with no receipts and no returns. `sale_money` is the single read of sold, collected, returned and balance per sale.
- 2026-11-20 — Vocabulary: the schema keeps `customer`; the screen says `patient`. The seam is the value, not the layer — a row is a customer until it renders, and only strings cross. `createPatient(...)` was a server action named with the UI word and is now `createCustomer(...)`; the Home card that read "Customers" was the only leak the owner could see and now reads "Patients". Enforced by two checks: the word "customer" never renders on a page, and no file mixes both vocabularies.
- 2026-11-20 — The bot's bookings will enter through the clinic's Google Calendar (its secret iCal feed), not through the GHL webhook: the bot writes to that calendar, so the feed also carries moves and cancellations, and one feeder cannot duplicate another. The webhook stays built and dormant. Blocked on access to the clinic's Google account.
- 2026-11-20 — Appointments is the agenda of record: every `booked` booking in one list ordered by slot, no date window (a past slot left unmarked stays on top flagged `Late`), a History tab for the resolved with `Day | Range`; booking, resolving and rescheduling happen there, and a marked booking offers no action.
- 2026-11-20 — GoHighLevel pushes the booking only; it never pushes a show-up or a no-show. `appointments.external_ref = ghl:<appointment id>` is unique, so a retried delivery returns the same booking instead of a second one.
- 2026-11-20 — The intake reads the calendar map before it resolves the customer: an unmapped calendar answers `422` and leaves nobody in the master. Guessing a category would put a booking in the wrong column of every report.
- 2026-11-20 — The intake route requires `x-ghl-secret` (`GHL_WEBHOOK_SECRET`); the URL alone is not the secret, and an unset secret answers `500` rather than opening the door.
- 2026-11-20 — Catalog: search by name or code, a Memberships tab for `unit_type = membership`, a Margin reference column (list price − today's cost, `—` when unknown; the monthly report stays the authority for realized margin) and a fixed-width grid (`max-w-5xl`, `table-fixed`) that does not change between tabs.
- 2026-11-20 — Date filter `Day | Range | All`: Sales details defaults to today, the Patient report defaults to All (the directory, so the search is not blocked) and both paginate 20 rows.
- 2026-11-20 — Patient report period view: only patients with sales in the period, with Spent/Returns/Visits for the period and Balance/Next due lifetime.
- 2026-11-20 — Patient detail reads item names from `sale_lines.item_name` (not `sale_items.description`) and hides the Appointments section when it is empty.
- 2026-11-20 — UI rules: verify the interface with Playwright (open, force dark, screenshot, read it back) instead of asking the owner for captures; every control is the installed shadcn/Base UI component, added with `shadcn add` when missing, never a hand-rolled widget.
- 2026-11-20 — A live sale is written only through `create_sale(...)`: the sale, its frozen `list_price` (price list on the business day, item price as fallback), the payment plan and the receipts land atomically; `visit_number` and `is_first_visit` are derived, a first visit requires a source, and the plan must equal the sale total. No screen touches `sales`, `sale_items`, `sale_payments` or `payment_receipts` directly.
- 2026-11-20 — The sale screen's payment model: each scheduled payment is an installment with an optional "collected now" amount that becomes a receipt (`source 'manual'`); "paid in full now" is one installment plus one receipt, and a split or financed sale is just more installments.
- 2026-11-20 — The sale entry offers only active items with a price, because an unpriced item's list price could not freeze; the actor is the fixed `front-desk` until login exists (single clinic, one staff account).
- 2026-11-20 — One sale per patient per business day (existing `sales_customer_day_uidx`) is surfaced as a clear refusal from `create_sale`, matching "one visit = one sale".
- 2026-11-19 — Appointments: everyone who books enters the customer master; a booking is `booked → show_up | no_show | cancelled`, terminal once; conversion is the first attendance and LTV the revenue after; the sale points at the booking and resolves it; rates group by the local slot day, Monday to Saturday.
- 2026-11-19 — Every catalog item has a stable code, assigned once and never reused, in four series: `TRT-` treatment, `PCK-` package, `PROD-` product, `SRV-` service. A package is a treatment with `unit_type = 'package'` and gets its own series. The UUID stays the internal key. `catalog_items` exposes kind, code, name, price, today's cost, active and unit_type.
- 2026-11-19 — Voiding and rescheduling are functions, not raw updates: `void_sale`, `void_payment` and `reschedule_payment` always write the actor and the reason, and a reschedule writes `sale_payment_changes` (from, to, when, who, why). A installment with receipts can be neither voided nor moved.
- 2026-11-19 — A cost is an interval in `item_cost_history` with timestamps from a moment to infinity; a sale never stores a cost and its margin is derived from the interval covering `sales.billed_at`. A change at 14:00 cannot touch a sale billed at 09:00; correcting a past interval changes the margin without touching a sale.
- 2026-11-19 — Profitability is reported per treatment and per product, accumulated by month (`item_monthly_profitability`). The line is the raw record; the monthly cut is the report. Margin is `revenue_with_cost − cost`: a line with no known cost stays visible as revenue and contributes no margin.
- 2026-11-19 — A line with a quantity and no price anywhere — no treatment price, no product price, no total — is not a sale and is not registered. 38 such rows had been imported; they were removed on 2026-11-19 with a copy outside the repository. A zero amount never means courtesy.
- 2026-11-19 — Money attribution: revenue belongs to the sale date, cash to the receipt date, returns and write-offs to the month they happen. Sales months are **not** closed in the MVP; only expense months are.
- 2026-11-19 — Cancelling future installments always proposes a write-off of the uncollected amount, prefilled and editable; the default is to forgive, and setting it to zero keeps the debt.
- 2026-11-19 — A payment is a receipt: `sale_payments` holds the plan (`pending`/`void`) and `payment_receipts` holds the evidence. "Paid" and "partial" are derived from receipts, never stored as a status.
- 2026-11-19 — A no-show charge is an adjustment (revenue +, cash +, no cost), never a sale line, so it does not inflate visits or new patients.
- 2026-11-19 — The 12.208,59 of historical "discount" is an artifact of backfilling `list_price` with today's catalog: it is marked `backfilled` and excluded from margin and discount claims.
- 2026-11-19 — Stripe fees stay in expenses, not in revenue.
- 2026-11-19 — `Consultation` and `Medicine Consult` stay in `treatments`; `PRP Microneedling` stays a free-text line until it repeats in a second sale.
- 2026-11-19 — The July `+1.130` Stripe line is not loaded: unallocated cash, excluded from revenue and balance.
- 2026-11-19 — Installment calendar: `pending` and `void` are exclusive (a cancelled future installment is `void` with a reason and never asks for confirmation); rescheduling moves `due_on` of pending installments only, with an audit row; a day that does not exist in a month clamps to its last day; a new date in the past is rejected. No Stripe integration: the subscription is cancelled or moved by hand in Stripe, and the monthly reconciliation is where reality corrects the plan.
- 2026-11-19 — Returns, chargebacks and anything that means money leaving a sale are a transaction of their own (`sale_refunds`), outside `sales`: the user picks customer → original sale → amount (full or partial) → method → date → reason, and the return is later reconciled (`pending` → `refunded`). The original sale is never edited. A cancellation with no money returned remains a state on the sale (`void`), refused when the sale has receipts.
- 2026-11-19 — A refund that already moved cash changes revenue and cash by the same amount, so it does not change `customer_balances.balance`; a refund still owed to the patient would. The month is settled in D4: returns hit the month they happen.
- 2026-11-19 — Monica Reviglio's $100 (2026-10-13) and Maria Elena Cabrera's $82 (2026-08-25) count as collected. The owner confirmed the workbook comments were notes at sale time, not open balances. No pending payment is added; `customer_balances` stays at zero owed.
- 2026-11-19 — Access is server-only: `anon` and `authenticated` keep no grants on `public`, the browser never talks to the Data API, and the Next.js server uses the secret key (`service_role` bypasses RLS). Why: no per-user isolation is needed, so policies would all be `using (true)`; with zero grants there is no policy to forget, and the schema stops being public.
- 2026-11-19 — `customer_balances` reports `sold − paid` as `balance` and keeps `is_settled` as `balance <= 0`. Why: `pending = 0` is true for anyone with no scheduled payment, which read as "settled" for 12 customers who never bought anything.
- 2026-11-19 — Views are created `with (security_invoker = true)` and the API grants are revoked after every view. Why: views are owned by `postgres` and default to `SECURITY DEFINER`, which quietly bypasses RLS.
- 2026-11-19 — Patient-level sources (the workbook, `customers.csv`, `customers-identities.md`, the review workbook) stay out of git. Why: git history is permanent and the repo is meant to be pushed; the files stay on disk and the import is never re-run.
- 2026-11-19 — Packages are `unit_type = 'package'`, quantity always 1, price set by the owner, contents as free text. Composition is not modelled because the owner prices the bundle as one thing.
- 2026-11-19 — Margin is `revenue − cost` with no conditional branch. Cost cannot be provisional in the formula; a placeholder is just a number in the catalog.
- 2026-11-19 — Sale lines freeze `unit_cost`, `list_price` and `line_margin`, with `item_cost_history` per catalog item. A cost update recalculates only the open month, never closed ones.
- 2026-11-19 — Product costs set to $1.00 as a placeholder so the flow never blocks; the owner will supply real averages and `set_product_cost` will apply them.
- 2026-11-19 — A zero in a treatment or product column means discontinued or a one-off package; it is not an error and is not imported.
- 2026-11-19 — A row with quantity 1 and a Total but no unit price takes the Total as the unit price. A row with quantity and no price anywhere is a real zero.
- 2026-11-19 — Sale lines keep the discount: `list_price` versus `unit_price`, so a negotiated price does not disappear.
- 2026-11-19 — New vs repeat is decided by "first purchase ever", not by anything inside the month. October shows 92 sales but 32 new patients, so counting rows inflates leads 3x.
- 2026-11-19 — `sales.is_first_visit` stored at insert time (true when the customer has no earlier sale) so the flag is a real field, not a computed guess at read time.
- 2026-11-19 — `source` is frozen on the first visit; later visits do not ask for it again.
- 2026-11-19 — `W/L - Mens Health` mapped to `mens_health` because it is 1 row of 506 and the meaning is unambiguous.
- 2026-11-19 — `Memorial Day` excluded from customers because it is a holiday marker with a zero total, not a patient.
- 2026-11-19 — Customer identity resolved by fuzzy match (≥ 0.86) plus two manual calls: Claudia and Claudio Rodriguez split (aesthetics vs men's health, no overlap), Sandea Desme merged into Sandra (same service, price and payment).
- 2026-11-19 — Category modelled as a property of the sale, not of the service, because 11 of 34 services appear under more than one category.
- 2026-11-19 — MVP scope: the transactional table only. The monthly summary and the expense block stay in the Excel.
- 2026-11-19 — Single tenant: one med spa, so no `org_id` and no per-tenant RLS.
- 2026-11-19 — Supabase as the backend (auth + DB) instead of a custom service. It gives auth and RLS without maintaining a backend.
- 2026-11-19 — Project skills live in `.agents/skills` (versioned) and cross-project ones in `~/.agents/skills` (global). Project ones are pinned in `skills-lock.json`; global ones are not.
- 2026-11-19 — shadcn/ui as the component system: official `shadcn` + `migrate-radix-to-base` skills copied from the `shadcn-ui/ui` repo instead of using the preset CLI.
- 2026-11-19 — Project memory in `memory/` with six files plus an index; a decision is logged the same day it is made.
- 2026-11-19 — `@supabase/server` plus the secret key in `.env.local` for admin operations, instead of embedding `service_role` in the client.
- 2026-11-19 — Test user `empathoai@gmail.com` created through the Admin API with `email_confirm: true`, so testing never depends on the confirmation email.
- 2026-11-19 — All documentation, code and project files are written in English; the conversation with the owner stays in Spanish.

## Long-form

### D1 — Customer dedupe (2026-11-19)

Context: 506 dated rows, 236 distinct spellings of patient names. No patient ID in the source.

Decision: normalise (lowercase, strip accents and punctuation, drop descriptive tails after `-`, `/`, `(`), cluster with a 0.86 SequenceMatcher ratio on the whole name, then override by hand where the data disagrees. Result: 201 customers.

Alternatives discarded: exact-string only (leaves 30 avoidable duplicates); lower threshold (merges Claudia with Claudio); trusting the cluster blindly (same failure).

Consequences: the split and the merge are encoded in `.tmp/customers4.py` as explicit overrides, so they are reproducible and reviewable. On import the key is a UUID, `CUST-xxx` is only an import aid.

### D2 — Returns are their own transaction (2026-11-19)

Context: the schema cannot express money going back. `sale_items.unit_price >= 0` and `sale_payments.amount >= 0` reject a negative row, and there is no returns table, so a refund would have to edit the sale or lie about the payment.

Decision: everything that means money leaving a sale lives in `sale_refunds`, keyed by customer and original sale. Amount is positive, with its own `refunded_on`, `method_id`, `kind` (`refund` | `chargeback`), `external_id` for the Stripe refund, `reason`, and a reconciliation state (`pending` → `refunded`). The user selects customer → sale → amount (full or partial) → method → date → reason, and reconciles it later. The original sale is never edited; it keeps showing what was sold and collected.

Why: (1) the sale stays a frozen fact, which is the whole point of the frozen `unit_cost`/`list_price`; (2) selecting from a sale is how the owner thinks about a return, and it gives the reconciliation a target; (3) a negative line would corrupt the treatment ranking and the margin; (4) the same table absorbs chargebacks without new modelling.

Discarded: negative sale line (breaks metrics and frozen margin); negative payment (blocked by the CHECK, and it would erase the evidence that money was collected); editing the sale total (rewrites history).

Consequences: `sale_refunds` must exist before any returns UI; net revenue of a month is sales minus returns of that month; a completed return leaves `customer_balances.balance` at zero, a return not yet paid makes it negative (the clinic owes); a sale with receipts can never be voided, only returned; void stays a state on the sale for sales where nothing was collected.

### D3 — Installment calendar and the forecast (2026-11-19)

Context: Stripe is not integrated. The clinic sells a package with the first installment paid by card and the rest as a monthly plan; the forecast is what the pending installments promise per month. Patients cancel the future or ask to move the billing day, and the schema had no way to express either.

Decision:

1. `pending` and `void` are exclusive. A cancelled future installment is `void` with `voided_at` and `void_reason`; it never shows up as "pending confirmation". Its `due_on` is kept for history.
2. Cancelling the future is one action on the sale's schedule: void every pending installment from a cutoff date. Paid installments are never touched.
3. Voiding fixes the forecast, not the balance. If the clinic forgives the uncollected remainder, record a write-off as an adjustment (revenue down, cash unchanged); otherwise the balance keeps claiming money nobody will pay.
4. Rescheduling moves `due_on` of pending installments only, and writes an audit row (from, to, when, who, why). `paid` and `void` never change date.
5. A billing day that does not exist in a month clamps to that month's last day (the 30th becomes 28 February).
6. A new date already in the past is rejected before saving, because it would turn the installment overdue on the spot.
7. No Stripe integration: the subscription is cancelled or moved by hand in Stripe, and the monthly reconciliation is the only place where reality corrects the plan. A charge that arrives after cancellation shows up as an unexpected receipt, not as a pending installment.

Discarded: auto-marking installments as paid (nobody knows without Stripe, and a guess becomes a lie); deleting cancelled installments (loses the answer to "why did the forecast drop"); rescheduling by voiding and recreating (breaks the installment identity and the before/after comparison).

Consequences: the forecast is always computed, never stored; the monthly Stripe box is mandatory, not optional; a reschedule does not change revenue or balance, only the expected date.

### D4 — Money attribution and closing (2026-11-19)

Decision: revenue is attributed to the sale date, cash to the receipt date, and returns/write-offs to the month they happen. Sales months are not closed in the MVP; only expense months keep `open`/`closed`.

Why: the owner reads "how much came in this month" (cash) and "what did this treatment leave" (revenue at sale). Closing sales months would add a second freeze with no process behind it; the guarantees that matter are already provided by append-only receipts and by never rewriting a return.

Consequences: a return discovered in November against an August sale reduces November revenue, and August stays untouched. The report shows "sales of the month" and "returns of the month" as separate lines, so the difference is explainable without opening a closed month.

### D5 — Cancelling a plan forgives by default (2026-11-19)

Decision: "Void installments from…" voids the selected pending installments and pre-fills a write-off for their uncollected amount. The default is to forgive (write-off = amount). Setting it to zero keeps the debt and leaves those installments pending.

Why: the common case is a patient who stops coming and stops paying; leaving the balance claiming money nobody will pay is the lie the workbook already had. The exception (a cancellation fee) is the same dialog with the write-off at zero or with fewer installments voided.

Consequences: cancelling future installments is a two-part operation — forecast down (void) and revenue down (write-off) — unless the clinic chooses to keep the debt.

### D6 — Payments are receipts (2026-11-19)

Decision: `sale_payments` keeps only the plan (`due_on`, `amount`, `pending`/`void`, `voided_at`, `void_reason`). The evidence of money is `payment_receipts` (append-only: amount, received_on, method, external id, event id, who). "Paid" means receipts cover the expected amount; "partial" means they cover less. Neither is a stored status.

Why: a status column cannot represent two partial receipts, cannot prove who recorded what, and drifts from the bank. A receipt cannot.

Consequences: migration 32 converts the 470 historical `paid` rows into 470 receipts before dropping `paid_on` and the `(status='paid') = (paid_on is not null)` check. `customer_balances` and `cash_forecast` are rebuilt on top of receipts. The characterization test freezes today's totals before the migration runs.

### D7 — Cost is a price list with validity (2026-11-19)

Context: there is no inventory and no lots, so a product cost is an average, not a fact about a unit. The owner knows what she paid per month, and the price can move inside a month. Manipulating sale rows to fix a margin is not acceptable.

Decision:

1. **A cost is an interval** in `item_cost_history`: from a timestamp to `infinity`, never overlapping. The open interval is the current cost. `cost_at(kind, item, timestamptz)` resolves it.
2. **A price change is an interval edit**: `set_item_cost` closes the previous interval at that moment and opens the new one from it. A change at 14:00 cannot touch a sale priced at 09:00, because both carry a timestamp.
3. **A sale never stores a cost.** It stores what was sold, what was charged and `billed_at`: the moment the price was fixed. The margin is derived from the interval that covers `billed_at`. Imported sales point `billed_at` at their visit day at noon with `billed_at_source = 'reconstructed'`, because they were all inserted during the import.
4. **Calibrating a month** (`calibrate_month_cost`) rewrites the price list for that month only, splitting the surrounding intervals, and records the previous value in `cost_calibrations`. It changes the historical margin because it corrects the reference; it does not touch a sale.
5. **The catalog cost is the open interval**, updated when a change is dated today or earlier. A future-dated change does not move it yet.
6. **Margin only over known cost.** `margin = revenue_with_cost − cost`. Revenue with no covering interval is reported, flagged, and never counted as margin.
7. **The report is per treatment and per product, accumulated by month** (`item_monthly_profitability`).

Why: this is the ERP price-list model. The transaction is immutable by construction, the past is priced by the interval that covered it, and a correction is a change of reference with a record — not a rewrite of history.

Consequences: `sale_items.unit_cost`, `line_cost`, `line_margin`, `cost_source` and `cost_confirmed` were removed. A line's cost is one join away, and there is no cache to drift. The known gap: the 38 unpriced rows and the 17 free-text lines have no interval, so they never produce a margin.

### D8 — Appointments and the customer master (2026-11-19)

Context: the clinic books mostly through an external bot that owns availability, and logs the bookings in Excel. It needs to record who is coming, what happened, and whether the visit turned into a sale — without inventing revenue and without a lead table that turns repeat patients into new leads.

Decision:

1. **Everyone who books enters the customer master.** The desk searches by normalized name; a match links the booking, no match creates the customer with name, phone and optional birth date. There is no separate `leads` table.
2. **A booking is one row.** `booked → show_up | no_show | cancelled`, terminal once, with `resolved_by`, `resolved_at` and `resolved_on`; a cancellation carries a reason. A correction is a new reasoned booking, never a rewrite.
3. **Rescheduling is not a status.** It moves the slot and writes `appointment_changes` (from, to, when, who, why); the guard refuses a move without its audit row and a move into the past.
4. **Conversion is the first attendance**, not the first purchase. LTV is revenue after. `sales.is_first_visit` keeps meaning first purchase and is never redefined.
5. **The sale points at the booking.** `sales.appointment_id` is written once at insert and unique; a sale against a booked booking resolves it to `show_up` with `resolved_by = 'system'`, because a sale proves attendance. A sale against a no-show or a cancellation is refused.
6. **Rates group by `scheduled_on`**, the local day in `America/New_York`, Monday to Saturday. `cancelled` and `booked` never enter the rate, and a week with no resolved bookings returns no rate, not 0%.
7. **`customer_balances` lists only customers with a money fact.** A no-show has none, so it never appears there; the directory reads `customers`.

Why: the workbook inflated leads because it counted rows. A booking is an attendance fact, not a customer event, and the clinic already knows its patients. The identity key is the name the clinic types, normalized once in SQL and verified against all 188 existing rows.

Consequences: the customer master grows with people who never came, accepted by the owner. Twelve customers at 0,00 left the balance view. The sale screen must pass `appointment_id` when it is built; until then conversion has no numerator.

## 2026-11-20 — the consolidated base

- The owner replaced the historical source with `docs/Ingresos consolidados - Consolidado.csv`. It is the new base: 215 customers, 486 visits (435 sales, 51 appointments), 588 lines, 219.460,91. The previous base was discarded and its baseline archived as `docs/data/baseline-2026-11-19.json`.
- The visit ordinal is a stored fact: `sales.visit_number`, unique per customer, with `is_first_visit = (visit_number = 1)`. It comes from the file; when two spellings of one patient merge, the numbering is rebuilt by date.
- A visit with no purchase is an appointment with `show_up`, not a sale of zero.
- Membership is a third `unit_type` (`MEM-`) next to unit (`TRT-`) and package (`PCK-`). The taxonomy lives in `docs/catalog-taxonomy.md`.
- The catalog comes from the owner's master (`docs/catalog.csv`, 56 items). Items that only existed in the sales file were added with the most repeated price (8 items), so the owner can match them later.
- Sales are never rewritten to match the catalog. The catalog is the price list; the line keeps the price it was sold at.
- The two payment lines in the file (`Payment completion from another treat.` 362, `Remaining Balance` 731) were kept as services so no sale was altered; the owner decides whether they are money instead of services.

## 2026-11-21 — Expenses are classified, not guessed

- **A concept carries its kind of cost.** `expense_items.cost_behavior` is one of `fixed`, `variable`, `acquisition`, `owner_draw`, `capex`, and a report groups by it. No report matches an expense by name or slug again: that is what made the owner's draw invisible inside payroll, and why a new concept could not be classified without editing code.
- **The owner draw is its own concept** (`owner_draw`), kept under the `payroll` category so the category totals read exactly as before. A draw distributes profit; it is not the cost of keeping the clinic open, so reports leave it out of fixed overhead.
- **The historical months were split without moving a cent**: 2,880.00 + 12,000.00 = 14,880.00, delta 0.00. Because the month total is unchanged, a closed month stays closed and C18 holds. The guard trigger is disabled only inside that migration transaction, and the migration asserts the split and every closed total before it commits.
- **Guidance belongs to the concept, not the screen**: a short English line on the row says what to record and what not to, and the entry dialog shows it the moment the concept is picked. What the owner types about a particular line stays in `note`.
- **A new concept gets its key from its name**, through the same trigger pattern the catalog uses; the dialog never types a `normalized_name`.

## 2026-11-21 — One patient, one row

- **A customer is a person, not a spelling.** The consolidated import keyed on the exact normalized name, so the same patient written two ways opened two records: 23 groups, 26 extra rows, histories split and visit ordinals numbered twice. A merge moves sales, appointments and adjustments to the surviving row, appends the retired spellings to `aliases`, renumbers the visits, and writes a row in `customer_merges` before removing the duplicate. `customer_merges` is append-only, so every merge is auditable and can be walked back by hand.
- **Aliases are import history, not a matching key.** `aliases` records how a name was spelled in the source file; `resolve_customer` matches the exact normalized name only. The clinic finds the patient in the search and records the sale against them, so a variant spelling does not need to resolve through the master. The alias lookup existed for one day (`20261121080000`) and was reverted by `20261121100000` when the owner set the workflow: patients are not created twice, the sale is recorded against the existing one.
- **The baseline was regenerated, deliberately.** A merge rewrites `sales.customer_id`, and that id is part of the per-sale hash in `docs/data/baseline.json`. The old baseline is archived as `docs/data/baseline-2026-11-20.json`; the file was rebuilt after the merge so the regression instrument describes the corrected base. This is a master correction, not a check fix, and it is recorded here because it bends the usual "compared, never regenerated" rule.
- **The visit ordinal counts every visit, sale or not.** A show-up appointment with no purchase consumes an ordinal, so a patient can start at visit 2 or skip a number. The merge renumbers sales by day, so it must include the appointment days too: Mikel Cordero and Sandra Desme were compressed by one until the appointment was counted.
- **Claudia Rodriguez is not Claudio.** The four Rodriguez spellings were checked against what each patient bought: Claudio, Caludio and Cluadio share male-health treatments and two rows fell on the same day, so they are one man; Claudia's history is aesthetic (Botox, lip filler, biostimulator) and stays her own. A name-only merge would have joined two patients.

## 2026-11-21 — The package carries its total; the month is the installment

- **A package is sold whole.** The sale is 1980 over 4 months, paid in parts; the catalog stores the package total and its duration (`duration_months = 4`), so the line freezes a list price equal to what it charges. The 495 is the installment the payment plan collects, not a catalog price. Storing the monthly value on the package row — tried earlier the same day — made the sale freeze 495 while it charged 1980.
- **A unit treatment is not a package slice.** `TRT-0012` and `TRT-0037` are unit treatments with their own price and cost; deriving them from the package (÷ 4) is package logic applied to the wrong kind, and it was reverted the same day (migration `20261121140000`). The monthly supply (`TRT-0023`, 500 / 185) is its own product, and the package is a discounted bundle; neither cost follows the other.
- **The catalog column is the price in force today, and C20 enforces it.** The screen read `treatments.price` while a sale froze `price_on`, and 17 active items disagreed. The intervals were aligned to the column from today; C20 fails if the two ever diverge again, and a control proves it fires.
- **A price change is still one write.** `set_item_price` updates the interval and the column together; nothing writes one without the other.
- **History keeps its shape.** The 186 Tirzepatide lines at 495 (and the Timmix and Semaglutide ones) were installments; they stay as recorded. Regrouping them into a 1980 sale would rewrite the base, and restating their cost is a deliberate call that has not been taken.
- **The catalog is the definition, not an inference.** `Botox Treatment` is one item with cost 220 and price 720 in the owner's master; there is no per-unit Botox item and the dose is not a separate quantity. A per-unit model was proposed and withdrawn: the catalog says what a treatment is, and a guessed unit of sale must not be written into the master. If per-dose pricing is ever needed, it enters as its own item with its own price and cost.
