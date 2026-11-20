# Import plan — consolidated workbook (2026-11-20)

Source files, already cleaned by the owner:

- `docs/Ingresos consolidados - Consolidado.csv` — 553 rows, 216 patients, 486 visits (patient + date), 433 visits with a purchase, 53 without.
- `docs/Ingresos consolidados - customers.csv` — 216 names; `phone`, `birth_date` and `aliases` are empty today.

Nothing here is executed yet. The plan is blocked on the decisions below.

## What the source contains

- Dates in `MM/DD/YYYY`, from 05/01/2026 to 11/18/2026.
- One row per sale, with a **service slot and a product slot**; 122 rows fill both.
- 51 patient+date groups repeat across rows: same visit, several lines.
- `visit_number` is per visit, not per row: both rows of a visit carry the same number. Max 10.
- 59 rows sum 0 (21 on a first visit, 38 later). By visit: 53 visits without a purchase.
- 6 patients paid on the first visit and every later visit is 0.
- 88 patients have a charge on some later visit (memberships and monthly treatments).
- Payment methods: Credit 204, Cash 153, Stripe 128, Zelle 52, Cherry 10, Groupon 5, `Caren Credit` 1. Methods that were not recorded were left as **Cash** by decision of the owner.
- 40 rows carry a comment; the owner wants them stored, never computed.

## Decisions needed before writing a line of code

1. **`visit_number` becomes a column on `sales`** (`integer`, ≥ 1, unique per customer). `is_first_visit` becomes derived: `visit_number = 1`. Confirm.
2. **A visit with total 0 becomes an appointment**, not a zero sale: `status = show_up`, `scheduled_on = date`, `source` as recorded, no sale, no lines. Includes the 21 first visits at 0.
3. **One sale per (patient, date).** Rows of the same visit become lines of that sale.
4. **A row with service and product becomes two lines** of the same sale.
5. **Comments go to the sale**: `sales.notes`, one note per sale, joined with `; ` when a visit has several. Confirm, or ask for a per-line note (would need a new `sale_items.note`).
6. **Method mapping**: `Caren Credit` → Care Credit, `Groupon` stays a method, `Cash` is accepted as the catch-all.
7. **Fresh transactional base**: the current 432 sales are archived and the transactional tables are cleared before the load, or the new data is loaded next to it. The owner said not to compare with the current values; the plan assumes **replace**, with a dump taken first.

## Steps

0. **Safety dump.** Export `sales`, `sale_items`, `sale_payments`, `payment_receipts`, `sale_refunds`, `adjustments`, `appointments` to `.tmp/` before touching anything. Gitignored, not committed.
1. **Migration** `20261120_visit_number.sql`: add `sales.visit_number integer`, check `visit_number >= 1`, unique `(customer_id, visit_number)`, backfill nothing (table will be empty after the reset), and a trigger that sets `is_first_visit = (visit_number = 1)`.
2. **Catalog check** (read-only): every `Service` and `Product` name must resolve to an item by normalized name. Output the list of names that do not resolve; the owner decides whether to create them.
3. **Customers**: insert the 216 names with `resolve_customer`; `normalized_name` comes from the trigger; no phone, birth date or alias yet.
4. **Visits**: group the rows by `(full_name, date)`; read `visit_number` from the first row of the group.
   - Total 0 → appointment, done.
   - Total > 0 → sale with `occurred_on = date`, `customer_id`, `source_id` (only on the first visit), `notes` (comments), `billed_at` reconstructed at 12:00 America/New_York.
5. **Lines**: service slot → line with `treatment_id` or `service_id` by resolved kind; product slot → line with `product_id`. Quantity and unit value as given; `list_price` = unit value until a price list is defined.
6. **Payment**: one `sale_payments` row per sale, `due_on = occurred_on`, `amount = total`, `status = paid`, method as given; one `payment_receipts` row on the same date for the same amount. Split payments collapse to the first method; the comment keeps the truth.
7. **Validation report** (no comparison with the old base):
   - 216 customers, 486 visits, 433 sales, 53 appointments.
   - Sum of `line_total` equals 218.648,41.
   - Every line has exactly one subject.
   - No visit without a number, no number repeated per customer.
   - List of any row rejected, with its reason.
8. **New baseline.** The import defines a new cutover: `docs/data/baseline.json` is archived as `baseline-2026-11-19.json` and a new one is written after the load. The old file is never regenerated in place.

## Not in this file

These facts exist in the current base and have no row in the CSV. Decide whether to reapply them after the load:

- Refund to Frank Alonso: 837,00.
- Two Stripe no-show fees: 1.876,00 and 1.151,00.
- The three payment lines removed from revenue: 1.762,00 (Gloria 362, Claudia 400, Blanca 1.000).

## Risks

- Item names that do not resolve stop the load at that line; the report names them.
- `Cash` mixes real cash with unrecorded methods: the method mix is approximate by design.
- `visit_number` is trusted as given; a gap or a repeated number per patient aborts the load.
- Clearing the transactional base is irreversible without the dump from step 0.
