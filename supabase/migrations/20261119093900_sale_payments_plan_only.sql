-- 093900_sale_payments_plan_only.sql
-- sale_payments stops being a cash ledger and becomes the plan. Paid is derived from
-- receipts; a installment only carries pending or void, and a void always has a reason.
-- The two views that read paid_on are dropped here and rebuilt in 094000.

drop view if exists public.customer_balances;
drop view if exists public.cash_forecast;

alter table public.sale_payments drop constraint if exists payment_paid_has_date;
alter table public.sale_payments drop constraint if exists sale_payments_status_check;
alter table public.sale_payments drop constraint if exists sale_payments_amount_check;

alter table public.sale_payments
  drop column if exists paid_on,
  drop column if exists installments;

alter table public.sale_payments
  add constraint sale_payments_status_check check (status in ('pending', 'void'));

alter table public.sale_payments
  add constraint sale_payments_amount_check check (amount > 0 or status = 'void');

alter table public.sale_payments
  add constraint void_has_reason check (
    (status = 'void') = (voided_at is not null and void_reason is not null)
  );

comment on table public.sale_payments is
  'The payment plan: one row per installment expected. Pending means the obligation is live, not that it is unpaid; coverage is derived from payment_receipts.';
comment on column public.sale_payments.status is
  'pending (obligation live) or void (never to be charged). Paid and partial are derived from receipts.';
