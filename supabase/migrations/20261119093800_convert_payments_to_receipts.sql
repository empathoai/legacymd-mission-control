-- 093800_convert_payments_to_receipts.sql
-- The 470 imported payments become evidence plus a plan:
--   432 with an amount become one receipt each, dated the day they were recorded;
--    38 with amount zero carry no price in the source (25 are package lines, the rest
--       are named services), so their installment is voided and no receipt exists.
-- Note: these are not courtesies by decision; the cause per row is unknown.
-- The paid state and paid_on are cleared here; the plan-only migration drops the columns.

insert into public.payment_receipts
  (sale_payment_id, amount, received_on, method_id, source, recorded_by, note)
select p.id, p.amount, p.paid_on, p.method_id, 'import', 'import',
       'converted from the 2026-11-19 import'
from public.sale_payments p
where p.status = 'paid'
  and p.amount > 0
  and not exists (
    select 1 from public.payment_receipts r where r.sale_payment_id = p.id
  );

update public.sale_payments
set status = 'void',
    paid_on = null,
    voided_at = now(),
    void_reason = 'zero-value sale: no price recorded in the source'
where amount = 0
  and status <> 'void';

update public.sale_payments
set status = 'pending',
    paid_on = null
where amount > 0
  and status = 'paid';
