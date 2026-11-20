# Bugs & Risks

Open problems and things to watch. A risk that starts to hurt becomes an action in [`next-actions.md`](next-actions.md).

## Open bugs

| # | Symptom | Reproduction | Status |
|---|---|---|---|
| 10 | Nothing is pushed: the repository has no remote, so the only copy of everything is this disk | `git remote -v` prints nothing | Open. Add the origin and push; until then a disk failure loses the base, the migrations and the app |
| 2 | `Consultation` sells at $360 against $975 of cost (−615) | `select * from item_profitability where margin < 0` | Open, likely a loss leader |
| 3 | `Eterna IV Series Membership` sells at $135 against $300 of cost | same query | Open, price probably wrong in the workbook |
| 4 | Refunds and no-show charges could not be recorded: no `sale_refunds` and no `adjustments` | — | Fixed 2026-11-19 by migration 32: returns, adjustments and receipts exist; August `−837` and the two no-shows are loaded |
| 5 | Only expense periods know `open`/`closed`; sales months have no closing rule | `select status from public.expense_periods` shows the closed flag; nothing equivalent exists for sales | Closed by decision: sales months are not closed (D4) |
| 6 | Committed `docs/data/import-reconciliation.md` said 483 sales / 655 items / 218.886,91 while the live project had 470 / 626 / 219.492,91 | compare the file with `select count(*), sum(line_total) from ...` | Fixed 2026-11-19: the file was a pre-merge snapshot; rewritten to the final numbers with the history and the integrity checks |
| 7 | Frozen costs were bypassed by the reports: `item_profitability` and `monthly_pl` computed cost from the live catalog (`t.cost, p.cost, s.cost`), not from `line_cost`/`unit_cost` | `pg_get_viewdef('item_profitability')` | Fixed 2026-11-19 by `20261119093100_reports_read_frozen_cost.sql`: every margin view reads `line_cost`, and C12 guards that the two margin computations agree |
| 8 | `customer_balances.balance` was `sold − paid`, with no write-off and no return term, while the PRD defines `balance = sold − written off − collected` | `pg_get_viewdef('customer_balances')` vs `docs/PRD-money-flows.md` | Fixed 2026-11-19: the view computes `sold + adjustments(revenue − cash) − collected − pending returns`, guarded by C04 |
| 9 | The 12.208,59 historical discount is not marked as an artifact | `select * from information_schema.columns where column_name='backfilled'` returns nothing | Resolved differently: no marker column. C06 verifies `list_price` against `item_price_history` only after the cutover; the historical number stays a documented guess |
| 10 | The catalogs kept a `cost` column next to the interval list and they disagreed: `products.cost` said 60,90 while the interval said 1,00 | `select cost from products` vs `cost_on(...)` | Fixed 2026-11-19: the column, `cost_is_estimated` and the generated `margin` columns were dropped; the interval is the only cost |
| 11 | 38 of the 470 payments had `amount = 0`: a quantity with no price anywhere, which by decision is not a sale | `select count(*) from sale_payments where amount = 0` | Fixed 2026-11-19: the 38 rows were removed (`094300`); the base is 432 sales and 432 receipts |
| 12 | The previous base stored `sale_items.discount` from an inferred `list_price`: 140 lines positive, 118 negative | `select count(*) filter (where discount <> 0) from sale_lines` | Closed by the consolidated import: each line's `list_price` is the price charged in the file, so there is no derived discount. The Discount column stays out of Sales details |
| 13 | `Consultation` was a treatment while the clinic thinks of it as a service | the details screen showed Treatment | Closed by the consolidated import: the master lists Consultation as a Service and the catalog now follows it |


| 14 | 24 products have no cost; margin reads 100% for them | `select count(*) from products where active and not exists (select 1 from item_cost_history h where h.item_kind='product' and h.item_id=products.id)` | Open: owner to give the averages |
| 15 | 8 items exist only in the sales file and were added with the most repeated price | `select name, price from products where name in ('Arum Life','Arum Vital','FemGuard','Perform Supplement')` | Open: owner confirms the price |
| 16 | Two payment lines were kept as services so no sale changed: `Payment completion from another treat.` 362 and `Remaining Balance` 731 | `select name from services where name like 'Payment%' or name = 'Remaining Balance'` | Open: decide whether they are money, not services |

## Fixed

| # | Symptom | Fix |
|---|---|---|
| 1 | `customer_balances` reported every customer as settled: it decided from `pending = 0` and never compared against what was sold | `20261119092700_fix_customer_balances.sql`: balance is `sold − paid`, with `sold_total`, `visits` and `last_visit_on` exposed. Verified: 176 with money, 2 with no sale, 10 with a zero-value visit; sum of sold and paid both 219.492,91 |
| 2 | A stale `?page=` past the last row made Sales details, Patient report and the appointment History answer `500`: PostgREST refuses an offset past the end with `416` | Fixed 2026-11-20: `web/lib/pagination.ts` counts first and clamps the page to the last one that exists; the three list functions use it. Verified `?page=99` answers `200` on all three |
| 3 | Adding an expense for an item the month already had **silently replaced** its amount: the sheet keeps one line per item and supplier | Fixed 2026-11-20: the dialog loads the existing line and says "This month already has $X for Y. Saving replaces that line." Found by writing an expense through the UI, not by the rollback |
| 4 | The expense import swept past `Total Expenses` and counted `DERMA M 1.200`, a line the July sheet keeps below the total and outside its formula: July read 34.203,10 against the sheet's 33.003,10 | `select total from expense_periods where period = '2026-07-01'` | Fixed 2026-11-20: the line is voided with a reason and July closed again at 33.003,10. Root cause fixed in `scripts/import/build_expenses.py`, which now stops at `Total Expenses` |
| 5 | `Products` for November came from the audited copy (3.265,34) while the sheet said 3.667,00, and the sheet's own vendor breakdown (U/V) adds to 4.627,34 | `select amount from expense_entries e join expense_items i on i.id=e.item_id where i.name='Products' and ...` | Fixed 2026-11-20 by the owner's call: the sheet's 3.667,00 wins; November is 30.365,33. The vendor breakdown still disagrees and is not used by the base |

## Open risks

| Risk | Impact | Mitigation | Status |
|---|---|---|---|
| The sale entry actor was the fixed `front-desk` | Every live sale and receipt was recorded by the same name, so there was no per-staff audit trail | Closed 2026-11-20: login landed and every write takes the signed-in email from the session (`lib/auth.ts`). The write paths were typechecked, not re-run against the base | Fixed |
| The auth client falls back to `SUPABASE_SECRET_KEY` | The project has no publishable key in `web/.env.local`, so the password grant runs with the secret key. It still never reaches the browser, but a leaked server env would expose the service role | Add `SUPABASE_PUBLISHABLE_KEY` to `web/.env.local`; both clients already prefer it | Open |
| One session per account, no second factor | Whoever holds the clinic password has the whole base, and a stolen cookie lasts until it expires or is signed out | Single clinic account accepted for now; rotate the password in the Supabase dashboard if it leaks. Revisit with a second account or 2FA | Open |
| One sale per patient per day (`sales_customer_day_uidx`) | A second same-day transaction for one patient is refused | One visit = one sale; add lines to the existing sale. Reopen only if the owner needs intraday re-entry | Open |
| Split payments collapse to one method | A sale paid "credit + cash" is recorded under the first method only, so revenue by payment method is approximate for ~8 rows | Acceptable for the MVP; the schedule supports the split when the UI asks for it | Open |
| Product cost is a $1.00 placeholder in the open interval | Product margin reads ~99% for new sales until real costs arrive | `set_item_cost('product', id, cost, from_date)` once the owner gives the averages | Open |
| If the GHL webhook is ever activated, `ghl_calendar_map` is empty | Every delivery answers `422` and no booking lands, and GHL retries a non-2xx | One row per calendar seeds it. Moot while the Google feed is the feeder | Open |
| The bot's bookings have no feeder until the clinic's Google account is shared | `/appointments` only shows what the desk books by hand, and the weekly show-up rate has no bot bookings in it | The GHL webhook is built and dormant; ask for the calendar's secret iCal address together with the account access | Open |
| The secret iCal address reads the whole calendar | Anyone with that URL can read every event, and it cannot be scoped | Server-only env var, never logged, never in the browser; rotate it if it leaks | Open |
| The intake never moves or cancels | An appointment moved or cancelled inside GHL keeps its old slot and status here | The desk reschedules or cancels on the agenda, which writes the audit row. Accepted for now | Open |
| The webhook is unreachable until there is a public URL | `localhost` cannot receive the bot's booking | Deploy to Vercel (or a tunnel) and set `GHL_WEBHOOK_SECRET` there too | Open |
| No sale in the base has `collected = 0` | The **Void** action is disabled everywhere today; every sale was paid | Correct by design (a paid sale is corrected with a return). The rule is exercised in a rollback with a fresh unpaid sale | Open |
| The returns list is not paginated | A few hundred returns would render one long page | Sparse today (0 rows); add the 20-row pager when it grows | Open |
| A reopened month keeps a permanent audit row | `expense_period_changes` is append-only, so a test close/reopen leaves a mark | Never close or reopen a real month while testing; the API is covered by rollbacks | Open |
| A paid sale has **no sanctioned delete**: `payment_receipts_immutable` refuses the receipt and `guard_sale_void` refuses the void | A test fixture with money can only be removed by lifting the receipt guard inside one transaction and deleting in FK order (receipts → payment changes → refunds → payments → items → sale → customer); done once on 2026-11-20 for the `test` customer | Verify UI passes against a scratch plan and delete the fixture before it takes money, or accept the lift; never lift the guard outside a transaction | Open |
| Catalog Margin shows ~98% for products until real costs arrive | The catalog now advertises a margin that is fiction for products | The column note says it is a reference and the monthly report is the authority; load the product averages | Open |
| Only `Botox Membership` has `unit_type = membership` | The Memberships tab lists one item; `Eterna IV Series Membership` is still a unit treatment (`TRT-0028`) | Reclassify after owner confirmation; its code moves to `MEM-` | Open |
| 8 treatments carry a cost estimated at 70% of price | Their margin is indicative, not real | Owner to confirm the five best sellers first | Open |
| Refunds and no-show fees had no home | Refund Frank Alonso −837, Stripe no-show 1.876 and 1.151 were outside the balance | Closed: `sale_refunds` and `adjustments` exist and the three lines are loaded | Fixed |
| Account-level `sbp_` token in `.env.local` | Compromise reaches every project in the account | Revoke when the schema work pauses | Open |
| The old import generators were deleted with the previous base | Nothing reproduces the old 432-sale base | The base is the consolidated one; the previous baseline is archived | Closed |
| A future `create or replace view` silently drops `security_invoker` | A view recreated after `20261119092800` is `SECURITY DEFINER` again | Create new views with `with (security_invoker = true)`, or re-run the lock-down migration after touching a view | Open, watch on every migration |
| No RLS policies exist | RLS is defence in depth only: any role that regains a table grant can read everything | Keep the grants revoked; add policies only if the browser ever talks to the Data API | Accepted by design |

| Three payment lines were imported as products | PROD-0023 and PROD-0024 carried 1.762,00 of revenue that is really cash for a treatment never registered; three customers now show credits of 362,00, 400,00 and 1.000,00 | Adjusted on 2026-11-19: revenue −1.762,00, cash untouched, and the reason stored on each adjustment row | Open: the clinic must say which earlier treatment each payment belongs to |

## Closed on 2026-11-19

- Every historical payment imported as `paid`, including two comments that mentioned money still owed (Monica Reviglio $100, Maria Elena Cabrera $82). The owner confirmed both count as collected, so no pending row is added.
- RLS enabled with 0 policies and `SECURITY DEFINER` views let the publishable key read all 188 customers and the revenue. Closed by `20261119092800_lock_down_public_access.sql`; verified with a live request (401 for the publishable key, 200 for the secret key).
- The folder was not a git repository. `git init` plus the first commit `4f3aa38`.
