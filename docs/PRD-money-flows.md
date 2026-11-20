# PRD — Money flows: returns, cancellations, reschedules and receipts

**Date:** 2026-11-19 · **Status:** ready for review · **Scope:** MVP, single clinic
**Decisions behind it:** `memory/decisions.md` D2, D3, D4, D5, D6

## 1. Problem

The app records a sale but cannot express money going back, a plan being cancelled, a
billing day being moved, or a Stripe collection being confirmed. The workbook covered
these with a hand-written summary block, and four of those lines never reached the
database. Without these flows the balance and the forecast are guesses.

## 2. Definitions (closed, see D4)

| Term | Meaning |
|---|---|
| **Sold** | sum of `sale_items.line_total`, by sale date |
| **Collected** | sum of `payment_receipts.amount`, by receipt date |
| **Returned** | sum of `sale_refunds.amount`, by return date |
| **Written off** | adjustment that lowers revenue with no cash movement |
| **Pending** | scheduled installment still expected |
| **Overdue** | pending installment whose `due_on` has passed |
| **Balance** | `sold + adjustments(revenue − cash) − collected − pending returns` |
| **Owed back** | returns created but not yet paid |
| **Closed month** | month whose Stripe box was closed; later receipts belong to their own month |

A return that already paid out cancels out of revenue and cash, so it does not change the
balance; while unpaid it shows as **owed back**.

## 3. Flows and acceptance criteria

### 3.1 Register a return

Entry: top-level **Devoluciones**. Steps: customer → sale → amount → method → date →
reason → save → reconcile later.

- **R1** The entry point is its own screen, not a button inside a sale.
- **R2** The flow requires customer → sale; only sales with at least one receipt are selectable.
- **R3** Amount must be `> 0` and `≤ collected − already returned` for that sale; the UI shows the maximum allowed.
- **R4** Date cannot be in the future, nor before the sale date. Reason is required (≥ 4 characters).
- **R5** Saving creates the return as `pending`; the sale, its items and its receipts are unchanged.
- **R6** Reconciling sets `refunded` with a date and optional external id. Amount and method never change after saving.
- **R7** The sale keeps showing its original total; net revenue and `saldo` include the return by the return date.
- **R8** The sum of returns for a sale can never exceed its collected amount.

### 3.2 Cancel the future of a plan

Entry: sale → schedule → **Void installments from…**.

- **C1** Only `pending` installments on or after the cutoff become `void`; paid and already-void installments are untouched.
- **C2** A reason is required and stored in `void_reason` with `voided_at`.
- **C3** The dialog pre-fills a write-off equal to the uncollected amount of the voided installments; it is editable and the default is accepted.
- **C4** On confirm, the forecast of the affected months drops by the voided amount and the balance drops by the write-off.
- **C5** With the write-off set to `0`, the debt stays on the balance and the voided installments still never appear as pending.
- **C6** The original `due_on` of a voided installment is kept for history.

### 3.3 Reschedule the billing day

Entry: sale → schedule → **Reschedule payment**.

- **S1** Applies to `pending` installments from a cutoff date; the number of installments does not change.
- **S2** A day that does not exist in a month clamps to that month's last day (30 → 28 February).
- **S3** A resulting date in the past is rejected before saving, with a message.
- **S4** Each change writes an audit row: installment, from, to, when, who, why.
- **S5** `paid` and `void` installments never change date.
- **S6** Revenue, cash and balance do not move; only the expected date changes.

### 3.4 Monthly Stripe reconciliation

Entry: **Stripe** → month.

- **M1** The box lists **expected** (pending due in the month), **overdue** (pending due before) and **collected** (receipts in the month).
- **M2** Each expected installment offers **Collected** (amount prefilled, `received_on` required, external id optional) and **No llegó** (nothing changes; the installment becomes overdue the next day).
- **M3** A installment counts as paid only when its receipts cover its `amount`; a smaller sum is a partial and is shown as such, derived.
- **M4** Closing the month refuses receipts dated inside it. Later corrections are dated in their own month.
- **M5** The box shows the difference between expected and collected for the month.
- **M6** A receipt against a `void` installment is flagged as unexpected and requires a decision: return it or keep it as credit.

### 3.5 Adjustments

- **A1** Adjustments are created by a flow or by the owner; never by editing a sale.
- **A2** Kinds: `write_off`, `no_show`, `other`; each carries a signed `revenue_delta` and `cash_delta`.
- **A3** A no-show creates `revenue_delta > 0` and `cash_delta > 0` when collected, has no cost, and does not create a visit.
- **A4** Adjustments appear in the month of their own date.

## 4. Non-goals

Stripe API or webhooks; automatic collections; line-level returns (returns are per sale);
multi-currency; closing sales months; inventory.

## 5. Verification

Every acceptance criterion above becomes a test in the TDD step, on top of the
characterization snapshot of today's 470 sales / 626 lines / 470 payments and
219.492,91, which runs before migration 32 and must keep passing after it.

## 6. Open questions

None.
