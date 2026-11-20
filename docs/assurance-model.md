# Assurance model: how the modules agree

**Date:** 2026-11-19 · **Status:** revised after review · **Scope:** MVP, single clinic
**Decisions behind it:** D2–D6 · **Reviewed by:** design, structural and
implementation-readiness lenses. Their blockers are addressed in §10 and in the status
column of §7.

## 1. Problem

The money rules live in five documents and the schema enforces almost none of them. A
number the owner reconciled by hand can stop matching after a migration and nobody
notices: it already happened with the reconciliation document, which was committed with
the pre-merge numbers (483 sales, 218,886.91) while the database held the corrected ones
(470, 219,492.91). The data was right; the document lagged. That is the failure this model
guards against.

## 2. Goals and non-goals

**Goals.** One owner per fact; a short set of checks that can actually fail; an
independent oracle for the totals; a baseline that survives migration 32; a gate that
runs after every migration batch.

**Non-goals.** One document section per screen or branch; 152-cell effect matrices; API
contracts (none exist); a second close concept for sales months (D4 says they do not
close).

## 3. Principle

One **writable** owner per fact. Copies may exist, but they are derived or refreshed by a
named writer, and a check guards every copy that can drift.

| Fact | Writable owner | Copies and their writer |
|---|---|---|
| What something costs | `item_cost_history` (interval, `valid_to` up to 9999-12-31) | `cost_on(kind, item, date)` reads it; nothing stores a copy |
| What something lists for | catalog `price` | `sale_items.list_price` frozen at sale; `item_price_history` (missing) |
| What this sale charged | `sale_items.unit_price` | `line_total` generated |
| What this sale gave away | `sale_items.list_price − unit_price` | `discount` generated |
| What this sale must collect | `sale_payments` (the plan) | — |
| What was collected | `payment_receipts` (missing) | — |
| What came back | `sale_refunds` (missing) | — |
| What was forgiven | `adjustments` kind `write_off` (missing) | — |
| Access | the lock-down migration | runner re-applies it |

`item_price_history`, `payment_receipts`, `sale_refunds` and `adjustments` have no DDL
today. They are marked missing, not assumed.

## 4. The discount rule

A discount is not a campaign. It is the owner deciding, at the sale, to charge less than
the catalog price.

1. **The catalog holds the default price; a discount never edits it.** Lowering the
   catalog to give a discount erases the record: the next sale lists cheaper and no
   discount exists.
2. **The line freezes both prices.** `list_price` is the catalog price at that moment,
   `unit_price` is what was charged, `discount` is generated as
   `(coalesce(list_price, unit_price) − unit_price) × quantity`.
3. **The discount is the margin erosion when cost is unchanged.** `line_margin` is
   `line_total − line_cost`; against list price, the difference is exactly `discount`.

**Gap.** Historical `list_price` was backfilled with today's catalog, so the 12.208,59 of
"discount" before the cutover is a guess. There is no `item_price_history` and no
`backfilled` marker. Going forward the line freezes the real price; the past must be
labelled, not reported as fact.

## 5. The balance identity

One definition, and it is the only one:

```
balance = sold − written_off − collected − owed_back
```

* `sold` = Σ `sale_items.line_total` by sale date.
* `written_off` = Σ `adjustments` kind `write_off` by adjustment date.
* `collected` = Σ `payment_receipts.amount` by `received_on`.
* `owed_back` = Σ `sale_refunds` in state `pending` (money the clinic owes back).
* A return that already paid out cancels from revenue and cash, so it does not move the
  balance.
* A `no_show` adjustment carries revenue and cash together when collected; if it is
  charged and not collected, it belongs in `sale_payments` as a pending installment, not in
  `adjustments`.

Today `customer_balances` computes `sold − paid`, with no write-off and no return term.
It must be rebuilt to this identity in migration 32; until then the identity check is
blocked, and the view is documented as incomplete rather than authoritative.

The general form, when an adjustment carries cash and a sign, is
`balance = sold + Σ(adjustments.revenue_delta − adjustments.cash_delta) − collected − Σ returns pending`
(`docs/SDD-money-flows.md` §4). The four-term version above is its special case: a
write-off has cash 0 and a collected no-show has cash equal to its revenue.

## 6. The module dependency map

Only `live` rows carry agreements. `planned` rows name the migration that creates them.

| Operation | Writes | Status | Agreement |
|---|---|---|---|
| Register customer | `customers` | live | one normalized name per person; merge is a script with no schema path |
| Create sale | `sales`, `sale_items`, `sale_payments` | live | schedule equals sold; each line freezes cost and list price |
| Change catalog cost/price | catalog + `item_cost_history` | live | only the open month and unconfirmed lines; never a past month |
| Collect | `payment_receipts` | planned 32 | receipts never exceed the expected amount; date is the bank date |
| Return | `sale_refunds` | planned 32 | returns never exceed collected; the sale is never edited |
| Cancel future | `sale_payments` void + `adjustments` | planned 32 | voided installments never appear as pending; write-off never exceeds what was uncollected |
| Reschedule | `sale_payments.due_on` + audit | planned 32 | only pending installments; count unchanged; never a past date; every change audited |
| Record expense | `expense_entries` | live | a closed month rejects inserts |
| Report | nothing | live | reads frozen columns; never recomputes a price from the catalog |

Two rows are deliberately absent: package quantity 1, because the trigger already owns it
and a second check would test the trigger against itself; and voiding a sale, because D2
makes it impossible when there are receipts and C13 guards it.

## 7. The checks

Each check returns rows only when the system is inconsistent, and it names its oracle and
its negative control. A check without a control is not a check.

| ID | Asserts | Status | Oracle | Control |
|---|---|---|---|---|
| C01 | per sale: `Σ installments no anuladas + Σ write-offs = Σ line_total` | live | identity | a sale inserted without a schedule returns a row |
| C02 | per installment: `Σ recibos ≤ amount` | live | identity | a receipt over the amount, cap trigger disabled |
| C03 | per sale: `Σ returns ≤ Σ collected` | live | identity | an over-return, cap trigger disabled |
| C04 | per customer: the identity of §5 | live | identity + view | shift the view balance by one peso |
| C05 | no line after the cutover without a covering cost interval | live | decision D7 | an item created with no interval |
| C06 | after the cutover, `list_price` equals the price history effective on the sale date | live | price history | a line posted above its historical price |
| C07 | at most one `is_first_visit` per customer | live | decision | a second first visit |
| C08 | monthly revenue for the historical window equals the owner-verified total | live | the owner-verified 219,492.91 | change one line's total |
| C09 | no receipt exists against a void installment | live | PRD M6 | a receipt on a void installment, cap trigger disabled |
| C10 | a closed expense month rejects inserts and updates | live | guard trigger | an insert into a closed month must raise |
| C11 | every view is `security_invoker` and no `anon` grant exists | live, already wired | access decision | recreate a view without the option |
| C12 | the margin computed by item, by item-month and by month all agree and equal `revenue_with_cost − cost` | live | three independent paths | shift one formula by one peso |
| C13 | a voided sale has no receipts and no returns | live | decision D2 | a voided sale carrying a receipt, guard bypassed |

All thirteen are live since migration 32, each with a control that fires. C12 catches the
class of defect that was live until 2026-11-19: `item_profitability` computed a margin that
dropped every line without a cost, so its total did not equal revenue minus cost.

`C08` is the only check with an oracle outside the database. It is also the only one that
can prove a number is *right* rather than merely unchanged: every other check compares the
schema to itself. The monthly series is not used as an oracle because the only version on
record belongs to the earlier 483-sale import, so `C08` asserts the total, not the months.

## 8. Cutover and baseline

`cutover = 2026-11-20`: the first day not imported. Sales with `occurred_on <= 2026-11-19`
are historical; the rest are app-created. Checks that talk about "after the cutover" use
this literal.

The baseline is a committed snapshot of the historical window — totals, the six line
counts, and a per-sale salted hash with no patient data — regenerated only before a
migration and compared after. It is a regression instrument; it is not proof of
correctness. Correctness comes from `C08`.

It lives in `docs/data/baseline.json`: 432 sales, 219.492,91 sold and collected, the six
counts, a digest and one salted hash per sale. `scripts/write_baseline.py` refuses to
overwrite it without `--force`, and `scripts/run_checks.py` compares it after every batch,
so a moved number fails the run the moment it moves.

## 9. Runner and gate

Built on 2026-11-19:

* Checks live in `supabase/checks/*.sql` and **never** in `supabase/migrations/`: the
  migration runner records each applied file in `public.schema_migrations`, so a check
  stored there would run once, ever.
* `scripts/run_checks.py` posts each file through the same Management API call the repo
  already uses, prints `check NN: 0 rows` or the offending rows, and exits 1 on any
  non-empty result.
* Controls live in `supabase/checks/controls/*.sql`. Each one breaks the rule inside a
  `begin … rollback`, runs the same query, and must return a row. A control that does not
  fire fails the run.
* `scripts/apply_migrations.py` calls the runner after the existing access invariant, so a
  batch that breaks an agreement fails the batch.
* Waivers are not needed yet: all seven live checks pass on today's data. When one is
  needed it takes `id`, `reason`, `owner` and `expires_on`, and `--strict` ignores it.

## 10. Risks and failure modes

| Risk | Why it bites | Mitigation |
|---|---|---|
| A check restates its own definition | It can never fail; it looks like coverage | Every check names an oracle; C08 is external. A control is required, not optional |
| NULL sums pass silently | `sum()` over zero rows is NULL, so `NULL = 0` is neither true nor false | `coalesce(..., 0)` and `is distinct from` in every check |
| False positives on legitimate flows | Voiding a plan lowers the schedule by design | The identity includes write-offs and excludes void rows |
| Waivers rot | Every waiver is a check switched off | Expiry date, owner, and strict mode |
| Checks run once | A check inside migrations is recorded and never re-run | Checks live outside migrations |
| The gate goes red forever | Today's data violates C05 by design (17 lines) | C05 scopes to post-cutover; historical gaps are waived with a reason |
| The baseline becomes the truth | A snapshot of a wrong number preserves the wrong number | The baseline is labelled regression; C08 carries correctness |

## 11. Alternatives considered

* **Constraints and triggers only.** Rejected: they can enforce row rules but not the
  cross-table money identities, and two triggers already exist without covering any of
  them.
* **A prose catalog per operation.** Rejected: it drifts; this project's committed
  reconciliation document already drifted within a day.
* **A per-operation manifest now.** Rejected: six of eight operations have no DDL, so the
  manifest would describe invented tables. It becomes useful after migration 32.
* **A frozen snapshot only.** Rejected: it catches regression, not a number that was
  wrong from the start.
* **Chosen:** a small check suite with named oracles, a baseline for regression, and the
  existing gate.

## 12. Prerequisites

Done on 2026-11-19 by migration 32: `payment_receipts`, `sale_refunds`, `adjustments`,
`item_price_history`, `sale_payments.voided_at/void_reason`, `sales.voided_*`, the rebuilt
`customer_balances`, `cash_expected`, `cash_collected` and `monthly_money`.

The 38 unpriced rows were removed (`094300`); the 432 positive ones became one receipt each,
dated the day they were recorded. The historical window still totals 219.492,91 sold and
219.492,91 collected, with a 0,00 balance.

## 13. Order of work

1. Repair the oracles: the reconciliation document was corrected on 2026-11-19; the
   margin views read the frozen cost; `customer_balances` computes §5.
2. Write the baseline and the `cutover` constant.
3. Write C01, C05, C07, C08, C10, C11; wire `run_checks.py` into the migration runner.
4. Run migration 32; add its checks in the same change.
5. Unblock C02, C03, C04, C06, C09 and wire them.

Steps 1 to 5 are done. Step 2 is closed: `docs/data/baseline.json` holds the 432 sales, the
six counts, 219.492,91 sold and collected, and a per-sale salted hash; `run_checks.py` fails
the batch when any of them moves. C08 still asserts the total, and the monthly series stays
out because the only one on record belongs to the earlier 483-sale import.
