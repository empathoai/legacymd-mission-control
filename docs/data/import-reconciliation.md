> **Superseded 2026-11-20.** The consolidated import replaced the base this document describes; its numbers belong to the previous workbook. Kept for history. See `docs/import-plan-consolidated.md`.

# Import reconciliation — 2026-11-19

**Status:** final. These are the numbers the database holds after the customer merge, the
bundle corrections and the removal of the unpriced rows. This is the base to work from.

Source: `docs/Ingresos Follow-Up.xlsx`, sheets `may` … `november`.
Target: Supabase project `konjxlatjymqrzebvtdu`.

## Counts

| Step | Rows |
|---|---|
| Dated rows in the workbook | 506 |
| Minus the holiday marker (`Memorial Day`) | 505 |
| Rows with a quantity but no price anywhere (removed) | 38 |
| Distinct sales (customer + day, after alias resolution and the 11 merges) | **432** |
| Items created | **588** |
| Payments created (one per sale) | **432** |
| Customers | **188** |
| First visits | **176** |

505 rows collapse to 470 candidate sales because 35 were a second row for the same patient
on the same day. Of those, 38 had a quantity and no price anywhere, and the decision is
that they are not sales; removing them leaves 432.

## Money

| Measure | Amount |
|---|---|
| `sum(sale_items.line_total)` | **219.492,91** |
| `sum(payment_receipts.amount)` | **219.492,91** |
| Balance owed | **0,00** |
| Workbook `Total` column | 217.620,60 (not trusted) |
| Delta vs the workbook column | +1.872,31 |

The workbook's Total column is not trusted: it contains literal values where a formula was
expected, and at least one row shows `0` for a visit that clearly charged money. Revenue is
recomputed as `quantity × unit_price`, and every sale's items equal that sale's receipt.

## History of the count

* **483 → 470.** The 11 duplicate customer groups merged; two spellings of the same person
  on the same day became one sale (13 fewer).
* **655 → 626 items.** The 13 product bundles were re-imported with their real quantities
  and 29 lines were consolidated.
* **218.886,91 → 219.492,91.** The bundle corrections, three rows that took their `Total`
  as the unit price, and the recovered Arum line.
* **470 → 432.** The 38 unpriced rows were removed on 2026-11-19. They carried a service
  name and a quantity and nothing else. A copy is kept outside the repository in
  `.tmp/removed_zero_sales.json`.

The database was never rolled back. Each step is a correction with a record.

## Integrity checks run against the live database

| Check | Result |
|---|---|
| Sales with no line | 0 |
| Sales without exactly one receipt | 0 |
| Sales whose lines differ from their receipts | 0 |
| Sum of lines vs sum of receipts | 219.492,91 = 219.492,91 |
| Customers with a sale | 176 |
| Customers with no sale | 12 |
| Sales flagged as first visit with an earlier sale | 0 |
| Customers whose first sale is not flagged | 0 |
| Duplicate groups recorded in `customer_merge_candidates` | 11, all resolved |

## Known gaps, and they are not errors

* **1 line has no catalog match**: `PRP Microneedling` ($135), imported as free text.
* **17 lines are free text** (the bundles), by design, and carry no cost.
* **84 sales carried no payment method in the source**; they import as `unspecified`.
* **Two dates** had a wrong year (`2022-05-20`, `2025-06-22`); clamped inside their month.
* **Installments are unknown for history.** Every historical payment is one receipt dated
  the sale day. The schedule starts being captured from the next real sale.

## What this file does not cover

The four summary lines the workbook kept outside the dated rows. August `−837` is a return;
September `+1.876` and October `+1.151` are no-show adjustments; July `+1.130` stays out by
decision D4. All three loaded lines are dated in their own month.
