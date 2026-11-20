# SDD — Money flows: the tables behind returns, receipts and write-offs

**Date:** 2026-11-19 · **Status:** implemented on 2026-11-19 · **Feeds:** migration 32
**Inputs:** `docs/PRD-money-flows.md`, `memory/decisions.md` D2–D6, `docs/assurance-model.md`

This document turns the decided rules into tables, states and constraints. It does not
reopen a decision. Where it disagrees with an earlier document, this one wins and the
earlier one is corrected in the same change.

## 1. What migration 32 changes

| Object | Action |
|---|---|
| `sale_payments` | becomes the plan only: drops `paid_on`, `installments` and the paid biconditional; gains `voided_at`, `void_reason` |
| `payment_receipts` | new: the evidence that money arrived |
| `sale_refunds` | new: money leaving a sale |
| `adjustments` | new: write-offs and no-show fees |
| `item_price_history` | new: the twin of `item_cost_history`, for list prices |
| `sales` | gains `voided_at`, `void_reason`, `voided_by` |
| `customer_balances` | rebuilt on the identity of §4 |
| `cash_forecast` | replaced by `cash_expected` and `cash_collected` |
| 470 payments | the 38 unpriced rows are removed (`094300`); 432 become one receipt each |

Not in 32: the screens, the Stripe webhook, and any second close concept for sales months.

## 2. State machines

**Sale.** `created → voided`. A sale is created with its lines and its plan. It is voided
only when it has no receipts and no returns; `voided_at`, `void_reason` and `voided_by` are
set together. There is no edit and no delete.

**Installment (`sale_payments`).** `pending → void`, once. `pending` means the obligation is
live, not that it is unpaid: coverage is derived from receipts. `void` requires
`voided_at` and `void_reason`. A void installment is never reactivated.

**Receipt (`payment_receipts`).** A single state: recorded. No update, no delete, no
correction. A mistake is a return.

**Return (`sale_refunds`).** `pending → refunded`, once. `pending` means the clinic owes the
money; `refunded` means it left, and requires `refunded_on`. The amount and method never
change.

**Adjustment (`adjustments`).** A single state: recorded. A `write_off` is negative revenue
with no cash; a `no_show` is positive revenue with cash equal to it; `other` must state
both.

## 3. Tables

### 3.1 `sale_payments` (plan)

```sql
alter table public.sale_payments
  drop constraint if exists payment_paid_has_date,
  drop column if exists paid_on,
  drop column if exists installments,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text,
  add column if not exists voided_by text;

-- A zero installment is only allowed when it is void: it records that nothing was ever due.
alter table public.sale_payments
  drop constraint if exists sale_payments_amount_check;
alter table public.sale_payments
  add constraint sale_payments_amount_check check (amount > 0 or status = 'void');
alter table public.sale_payments
  drop constraint if exists sale_payments_status_check;
alter table public.sale_payments
  add constraint sale_payments_status_check check (status in ('pending', 'void'));
alter table public.sale_payments
  add constraint void_has_reason check (
    (status = 'void') = (voided_at is not null and void_reason is not null)
  );
```

`due_on` stays. `method_id` stays. Nothing else.

The supported operations are functions, so the control columns are always written together:
`void_payment(installment, by, reason)`, `void_sale(sale, by, reason)` and
`reschedule_payment(installment, new_due, by, reason)`. A reschedule writes
`sale_payment_changes` (from, to, when, who, why). A trigger refuses voiding or
rescheduling a installment that has receipts, and a date in the past.

### 3.2 `payment_receipts`

```sql
create table public.payment_receipts (
  id               uuid primary key default gen_random_uuid(),
  sale_payment_id  uuid not null references public.sale_payments(id) on delete restrict,
  amount           numeric(12,2) not null check (amount > 0),
  received_on      date not null,
  method_id        uuid not null references public.payment_methods(id) on delete restrict,
  external_id      text,
  stripe_event_id  text unique,
  source           text not null check (source in ('manual', 'webhook', 'import')),
  recorded_by      text not null,
  note             text,
  created_at       timestamptz not null default now()
);
```

* A receipt never exceeds what is still expected: enforced by a trigger against
  `sale_payments.amount` minus the receipts already recorded for that installment.
* Two partial receipts are allowed; a duplicate webhook is not, because
  `stripe_event_id` is unique.
* Immutability: `revoke update, delete` and a trigger that raises on either.

### 3.3 `sale_refunds`

```sql
create table public.sale_refunds (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id) on delete restrict,
  amount        numeric(12,2) not null check (amount > 0),
  refunded_on   date not null,
  method_id     uuid not null references public.payment_methods(id) on delete restrict,
  kind          text not null check (kind in ('refund', 'chargeback')),
  state         text not null default 'pending' check (state in ('pending', 'refunded')),
  refunded_at   date,
  external_id   text,
  reason        text not null check (length(btrim(reason)) >= 4),
  recorded_by   text not null,
  created_at    timestamptz not null default now(),
  constraint refunded_has_date check ((state = 'refunded') = (refunded_at is not null))
);
```

* The sum of returns for a sale never exceeds its receipts: trigger.
* No update of `amount`, `method_id` or `kind`; only the state transition.

### 3.4 `adjustments`

```sql
create table public.adjustments (
  id             uuid primary key default gen_random_uuid(),
  occurred_on    date not null,
  customer_id    uuid references public.customers(id) on delete restrict,
  sale_id        uuid references public.sales(id) on delete restrict,
  kind           text not null check (kind in ('write_off', 'no_show', 'other')),
  revenue_delta  numeric(12,2) not null default 0,
  cash_delta     numeric(12,2) not null default 0,
  reason         text not null check (length(btrim(reason)) >= 4),
  recorded_by    text not null,
  created_at     timestamptz not null default now(),
  constraint adjustment_moves_something check (revenue_delta <> 0 or cash_delta <> 0),
  constraint write_off_is_negative check (
    kind <> 'write_off' or (revenue_delta <= 0 and cash_delta = 0)
  ),
  constraint no_show_is_settled check (
    kind <> 'no_show' or (revenue_delta > 0 and cash_delta = revenue_delta)
  )
);
```

`customer_id` may be null only for unallocated cash, which has `revenue_delta = 0`.

### 3.5 `item_price_history`

The twin of `item_cost_history`, with the same shape and the same known defect fixed:
`effective_from` is a real date, not the first of a month, so two changes in one month do
not collide.

```sql
create table public.item_price_history (
  id             uuid primary key default gen_random_uuid(),
  item_kind      text not null check (item_kind in ('treatment', 'product', 'service')),
  item_id        uuid not null,
  price          numeric(10,2) not null check (price >= 0),
  effective_from date not null,
  note           text,
  created_at     timestamptz not null default now(),
  unique (item_kind, item_id, effective_from)
);
```

Seeded from the current catalog with `effective_from = 2026-05-01` and the note
`'catalog price, no real effective date'`. C06 applies after the cutover only.

### 3.6 `sales` void columns

```sql
alter table public.sales
  add column if not exists voided_at  timestamptz,
  add column if not exists void_reason text,
  add column if not exists voided_by  text;
alter table public.sales
  add constraint voided_has_reason check (
    (voided_at is null) = (void_reason is null)
  );
```

A trigger refuses to void a sale that has receipts or returns, and refuses any update to
`occurred_on`, `customer_id` or `is_first_visit` after creation.

## 4. Identities

Signed deltas, one definition:

```
revenue_net = Σ line_total + Σ adjustments.revenue_delta − Σ sale_refunds.amount
cash_net    = Σ receipts    + Σ adjustments.cash_delta    − Σ sale_refunds (state = 'refunded')
balance     = revenue_net − cash_net
            = sold + Σ(adjustments.revenue_delta − adjustments.cash_delta)
                   − collected − Σ sale_refunds (state = 'pending')
```

Consequences, checked: a write-off lowers the balance; a collected no-show leaves it
unchanged; a paid return leaves it unchanged; a return still owed makes it negative.

This replaces the four-term line in `assurance-model.md` §5, which assumed every adjustment
was either a write-off or settled. It is the same arithmetic written generally.

## 5. Views

* `customer_balances`: per customer `sold_total`, `collected_total`, `written_off_total`,
  `pending_return_total`, `balance`, `visits`, `last_visit`, `is_settled`
  (`balance <= 0`), `next_due_on` (pending installments with expected > 0), `is_overdue`
  (`expected > 0 and due_on < current_date`). Voided sales are excluded from every term.
* `cash_expected`: month of `due_on`, `expected = Σ(amount) − Σ(receipts)` for live installments,
  plus `overdue` for the part already past due.
* `cash_collected`: month of `received_on`, `collected = Σ(receipts.amount)`.
* `cash_forecast` is dropped; any consumer moves to the two views above.

All new views are created `with (security_invoker = true)`. C11 fails if one is not.

## 6. Converting the 470 payments

| Case | Rows | Becomes |
|---|---|---|
| Amount > 0 | 432 | installment stays `pending`, one receipt with `received_on = paid_on` (the sale date), `source = 'import'`, `recorded_by = 'import'` |
| Amount = 0 | 38 | removed with their sale (`094300`): a quantity with no price anywhere is not a sale |

The zero rows are not courtesies by decision: 25 of the 38 were package lines and the rest
named services (Weight Loss, IV Series, Consultation, IV Single, Botox, Microneedling). What
the source shows is a missing price. The rows were briefly converted to void installments and then
removed; a copy of the 38 sales and their lines is kept in `.tmp/removed_zero_sales.json`,
outside the repository.

After both steps: 432 receipts totalling 219.492,91; 432 sales, 588 lines, 432 installments, all
pending and fully covered, so `cash_expected` shows nothing for May–November.

The conversion runs in one transaction with the receipts insert first, then the installment
update, so a failure leaves nothing half-done.

## 7. Checks this unblocks

| Check | Becomes |
|---|---|
| C02 | `Σ receipts ≤ amount` per installment, enforced by trigger and asserted by the check |
| C03 | `Σ returns ≤ Σ receipts` per sale |
| C04 | the identity of §4, asserted through `customer_balances` and recomputed from base tables |
| C06 | after the cutover, `list_price` equals the price history row effective on the sale date |
| C09 | a receipt against a void installment is impossible: the trigger refuses it, and the check asserts no such row exists |
| C13 | no voided sale has a receipt or a return |

C01 is extended with the write-off term in the same change.

## 8. Enforcement versus assertion

| Rule | Enforced by |
|---|---|
| receipt ≤ expected per installment | trigger |
| return ≤ collected per sale | trigger |
| receipt/refund immutability | revoke + trigger |
| void installment has reason and date | check constraint |
| voided sale has no receipts or returns | trigger |
| package quantity 1 | existing trigger |
| balance identity | check C04 (not a constraint: it spans five tables) |

A rule with no enforcement point is a check, and the check names it. A rule with one is
referenced, not restated.

## 9. Order of migration files

| File | Content |
|---|---|
| `093200_payment_receipts.sql` | table, cap trigger, immutability trigger, revoke |
| `093300_sale_refunds.sql` | table, cap trigger, state-only update |
| `093400_adjustments.sql` | table, constraints |
| `093500_item_price_history.sql` | table, seed |
| `093600_sale_payments_void_columns.sql` | `voided_at`, `void_reason` |
| `093700_sale_void.sql` | `sales.voided_*`, guard trigger |
| `093800_convert_payments_to_receipts.sql` | 432 receipts, 38 void installments (removed next) |
| `093900_sale_payments_plan_only.sql` | drops the paid column and its check |
| `094000_views_money.sql` | `customer_balances`, `cash_expected`, `cash_collected`, compatibility `cash_forecast` |
| `094100_load_workbook_lines.sql` | August `−837` return, September `+1.876`, October `+1.151` |
| `094200_monthly_money.sql` | gross revenue, returns, adjustments, net revenue, collected |

The conversion had to run before the plan-only file: clearing `paid_on` while the old
biconditional still exists requires nulling the column, and the receipt needs its value
first.

The old 092800 lock-down file is not edited: the new views carry `security_invoker` in
their own creation, and C11 fails if one is missing.

## 10. Acceptance

Migration 32 is done when, in one run of `apply_migrations.py`: C01–C13 pass, every
control fires, and `customer_balances` reconciles to 219.492,91 sold, 219.492,91 collected
and 0,00 balance for the historical window.
