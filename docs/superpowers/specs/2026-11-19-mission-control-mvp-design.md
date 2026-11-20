# Mission Control MVP — design

**Date:** 2026-11-19
**Status:** approved in conversation, pending execution

## Intent

Replace the Excel workbook a med spa uses to log daily sales. The owner records a
sale when the patient arrives, from a PC. The workbook has one sheet per month with
a service block and a product block per row; that shape forces two rows when a
patient buys two treatments and makes repeat patients look like new leads.

Non-goals: inventory, expenses, monthly summary blocks of the workbook, lifetime
value analytics, upselling. Those stay in the workbook or wait.

## What the app must answer

- How much came in this month, and from which category.
- How many **new** patients this month (a returning patient is not a new lead).
- How much money is still expected (Stripe installments) versus already collected.
- Per customer: paid in full, or how much is pending.

## Model

| Table | Holds |
|---|---|
| `categories` | weight_loss, mens_health, aesthetics, performance |
| `sources` | referral, instagram, facebook, groupon, website, bot |
| `payment_methods` | seven methods + `unspecified`; flags `supports_installments`, `settles_immediately` |
| `customers` | one row per patient, `normalized_name` unique, `aliases` |
| `treatments` | procedures: cost, price, generated `margin`, default category |
| `products` | goods: cost, price, default category. No stock |
| `services` | anything else the business orders (lab work) |
| `sales` | one visit: date, customer, source (first visit only), `is_first_visit` |
| `sale_items` | one thing sold: exactly one of treatment/product/service/description |
| `sale_payments` | cash schedule: due date, amount, status, installments |

Views: `sales_with_totals`, `revenue_by_category`, `cash_forecast`,
`customer_balances`.

## Decisions that shape the schema

1. **Category is per sale line, not per treatment.** Eleven of 34 treatments are
   sold under more than one category; catalogs carry only a default suggestion.
2. **Payment is per installment, not per sale.** 42 rows in the workbook split a
   payment across methods or leave a balance; Stripe pays month by month.
3. **New versus repeat comes from purchase history.** October: 92 sales, 32 new
   patients. Counting rows inflates leads 3x.
4. **Stripe pending is real cash; Cherry is not.** Cherry and Care Credit pay the
   clinic in full at sale time, so those rows are `paid` with the patient's term
   recorded only as information.
5. **Three catalogs, no `kind` enum.** New services enter by inserting a row.
6. **Prices are defaults.** The sale line stores what was actually charged.

## Data reality (from `docs/Ingresos Follow-Up.xlsx`)

- 505 dated rows after removing one holiday marker ("Memorial Day").
- 236 spellings → 201 customers.
- 486 sales once rows of the same customer and day are merged; 668 items.
- Revenue recomputed from quantity x unit price: **219,132.91**. The workbook's own
  Total column sums 217,620.60 because of stale and broken formulas.
- 89 rows carry no payment method; they import as `unspecified`.
