# Current Strategy

The *now* state, not history. If this file is older than 7 days, treat it as stale and ask before acting on it.

_Last review: 2026-11-21_

## Now

The base is the owner's consolidated workbook: **189 customers** (23 duplicate groups merged on 2026-11-21; the variant spellings live in `aliases`), 435 sales, 588 lines, 219.460,91 collected, 51 appointments for visits without a purchase. Every sale carries its visit ordinal. The catalog has 66 active items with price and cost from the owner's master, and on 2026-11-21 the **20 product costs** came from that sheet too, backdated to 2026-05-01 so product margin is real from the first sale: the estimate the cutover had written and the $1.00 placeholder are gone, May–October margin rose 3.725,10, November fell 515,40, and gross margin reads **74.873,66** instead of 71.663,96. Only the four products the sheet omits (Arum Life, Arum Vital, FemGuard, Perform Supplement) carry the estimate the base already had — 57,40 / 57,40 / 35,00 / 35,00 — instead of the $1.00 placeholder that made them read 98% margin; their real purchase cost is still the clinic's to give, and PRP Microneedling and Regenerative Glow have no cost at all. A package stores its **total** price and cost (the 495 is the payment installment, not the item price) and carries no session count: how many sessions a patient takes depends on their progress, so it belongs to the patient's plan, not to the item. A unit treatment keeps its own price and cost and is never a package slice, and **C20** keeps the catalog price equal to the interval a sale freezes. November reads **18.599,92** sold and collected after the test records were removed, and the six closed months still match the sheet to the cent.

**The past is frozen.** The imported base is the workbook, not a draft: no restatement, no backfill, no correction of a historical margin or a missing session. `docs/data/baseline.json` and `C18` are the guard. Everything this session does from here serves **the current month forward**: every visit that happens is recorded, nothing is recorded at zero, and a program's sessions are counted as they happen. `session_progress` and `session_gaps` inform the desk; they are not a list of things to fix.

**Screens belong to the owner.** Since 2026-11-21 the owner builds every screen with another agent — routes, layout, components, copy, dialogs, styling — and this session does not design, restyle or fix one. What this session owes the screens is the data behind them: the views, the functions, the server actions and the numbers. The desk screens as they stand (Sales details with its total and status, the sale page, the catalog, the worklists, the sale entry draft, the loading and error screens) are the owner's surface from here on.

**The dashboards and the sales report are being designed and built by the owner with another LLM.** That is deliberate: it is the surface where the owner's taste decides, and the data layer behind it is finished (views `monthly_pl`, `cash_collected`, `monthly_money`, `sale_money`, `product_cost_variants`, `refunded_by_item`). This session does not build them; it keeps the base, the checks and the entry screens honest, and it answers the questions the other model needs.

The dashboard that ships from here shows real numbers — sold this month, collected, owed, show-up rate — plus four doors: New sale, Appointments, Patients, Open Items. It no longer says any module is "not built yet", and the "Prototype" badge is gone.

The UI now covers the full loop: catalog (five tabs — Treatments, Packages, Memberships, Products, Services — with search by name/code, a Margin reference column and a fixed-width grid; create, edit price and cost with validity), patients (new patient with search and validation, a searchable patient report that defaults to All and filters by Day/Range, patient detail), sales details (every sold line, read-only, Day/Range filter), the sale entry screen (patient search or create, catalog lines with frozen list prices — the picker shows kind and price, ranks priced items first and takes arrows and Enter — a payment plan with receipts, a sticky bar with the total and **Record sale**), the appointments agenda (every `booked` slot with `Today`/`Late`, History with the outcome and the reason, New booking, and one row of actions to mark who came, cancel with a reason or move the slot), **expenses** (each month with its total, the result after expenses and the category split; a line is added or corrected, voided with a reason, and the month is closed or reopened with a recorded reason), **returns** (the sales that can still give money back, the return recorded against the sale and settled when the money leaves) and **voids** (the sales with no money, voided once with a reason) as two separate sections, and **open items** (the installments still expected, by due month, with a payment recorded as a receipt and a charge cancelled with a reason).

A patient may buy more than once in a day: the business day is the visit, a second sale shares the ordinal and is not a first visit, and `visits` counts days. A correction is still append — void plus new, never a rewrite; a sale with money is corrected with a return, not a void.

**An expense concept says what kind of cost it is.** `expense_items.cost_behavior` is `fixed`, `variable`, `acquisition`, `owner_draw` or `capex`, with a short guidance line the entry dialog shows as soon as the concept is picked, so the person typing knows what belongs there. The assistant's wage is `Staff payroll` (2,880.00 a month) and the owner's draw is `Owner draw` (12,000.00), two concepts in the same payroll category; May–Nov 2026 were split with a 0.00 delta, so the closed months kept their totals. Reports classify by `cost_behavior`, never by name: fixed overhead excludes the draw, and the dashboard reads the operator's cost, not the owner's profit.

A UX audit with a context-free agent and the `ui-ux-pro-max` rule set ran over all 17 routes at 1440 and 390; its report is [`../docs/ux-audit-2026-11-20.md`](../docs/ux-audit-2026-11-20.md). It ranks the dashboard lie, the off-screen sale button and the ambiguous item picker first — all three are fixed — and leaves U1–U7 in [`next-actions.md`](next-actions.md).

The agenda is the only place the whole day exists: referrals, the website and phone calls never reach the bot, and the bot's own bookings are written to the clinic's **Google Calendar**. The intended feeder is therefore that calendar's secret iCal feed — it carries creates, moves and cancellations in one source — once the owner grants access to the Google account. The GoHighLevel webhook at `/api/ghl/appointments` is built, idempotent and **dormant**: two feeders would duplicate the same booking.

The vocabulary is one rule now: the schema says `customer`, the screen says `patient`, and the seam is the value — a row is a customer until it renders. `lib/customers.ts` is the single reader of the master; no page shows the word "customer".

The date filter is `Day | Range | All`: Sales details defaults to today, the Patient report defaults to All (the directory, so the name search works) and both paginate 20 rows. The catalog grid is a fixed `max-w-5xl` column so it does not jump between tabs.

A sale is written only through `create_sale(...)`: the sale, its frozen list prices, the payment plan and the receipts land atomically, `visit_number` and `is_first_visit` are derived, and a first visit requires a source. The immutable rule is written in `AGENTS.md`: the transactional base is never edited; corrections belong to the read layer or to a realignment procedure that uses the price and cost intervals.

A build is behind `/login`: one clinic account, email and password, a cookie session that `web/proxy.ts` verifies with `auth.getClaims()` on every request, a signed-out visitor sent to `/login?next=…`, and Sign out in the sidebar footer next to the signed-in email. **A development server runs without the gate** (`NODE_ENV !== "production"`), so the owner or another agent reviews a screen with no password; a write in that state records `dev@local`. Every write records the signed-in email as its actor instead of the old fixed `front-desk`. The auth client prefers `SUPABASE_PUBLISHABLE_KEY` and falls back to the server-only `SUPABASE_SECRET_KEY` until the publishable key is in `web/.env.local`.

## Next 30 days

1. **The catalog's shape against the owner's sheet**, now that price and cost agree: decide the 26 kind disagreements (nine packages stored as units, one membership, ten products the sheet calls Treatment, three services, three treatments the sheet calls Product) and one shape for the Timmix and Semaglutide pairs. Detail and evidence in [`../docs/catalog-reconciliation-2026-11-21.md`](../docs/catalog-reconciliation-2026-11-21.md).
2. Six costs and eight provisional prices still waiting on the owner: Arum Life, Arum Vital, FemGuard, Perform Supplement, PRP Microneedling, Regenerative Glow have no cost, and none of the 8 items added from sales appears on the sheet.
3. The UX backlog U1–U7, in the audit's order: one report or none, the expenses row that adds up, Sales details with a total and a status, the narrow-screen tables, visible actions on the empty worklists, losing nothing on navigation, and loading/errors.
4. Branded PDF of the patient report.
5. Deploy to Vercel once the sale screen is proven in the clinic: it also gives the GHL webhook its public URL.
6. Access to the clinic's Google account, for the calendar's secret iCal address and one sample event; then the Google sync replaces the dormant GHL webhook as the bot's feeder.

## Not doing (this session)

- **The dashboards and the sales report**: the owner builds them with another LLM. Offer the data contract, not the screen.
- A second UI pass on the screens the audit already covered until U1–U7 are done.

## Not doing

- Lifetime value, recurrence curves and "last treatment" analytics. The data supports them later (first visit + every sale is kept), but they are out of the MVP.
- Upselling recommendations. It is internal business strategy, not a data problem, and it needs its own rules before it needs code.
- Package composition (what is inside a package). The owner writes it as free text.
- Per-user data isolation. One clinic, one staff account is enough; access is server-only.

## Decisions backing this strategy

- See [`decisions.md`](decisions.md) and `docs/HANDOFF.md`.
