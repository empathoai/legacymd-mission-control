-- Control for C09: a receipt on a void installment must be reported. There are no void installments
-- left in the data, so this control creates one, disables the cap trigger that would
-- refuse the receipt, and rolls everything back.
begin;

insert into public.sales (occurred_on, customer_id, is_first_visit)
values (
  date '2026-11-20',
  (select id from public.customers order by id limit 1),
  false
);

insert into public.sale_payments
  (sale_id, method_id, due_on, amount, status, voided_at, void_reason, voided_by)
select s.id, pm.id, date '2026-11-20', 10, 'void', now(), 'control: void installment', 'control'
from public.sales s, public.payment_methods pm
where s.occurred_on = date '2026-11-20'
  and pm.slug = 'unspecified'
order by s.created_at desc
limit 1;

alter table public.payment_receipts disable trigger payment_receipts_within_expected;

insert into public.payment_receipts
  (sale_payment_id, amount, received_on, method_id, source, recorded_by, note)
select p.id, 1, date '2026-11-20', p.method_id, 'manual', 'control',
       'control: receipt on a void installment'
from public.sale_payments p
join public.sales s on s.id = p.sale_id
where p.status = 'void'
order by p.created_at desc
limit 1;

select
  r.id as receipt_id,
  r.sale_payment_id,
  r.amount,
  p.status
from public.payment_receipts r
join public.sale_payments p on p.id = r.sale_payment_id
where p.status = 'void';

rollback;
