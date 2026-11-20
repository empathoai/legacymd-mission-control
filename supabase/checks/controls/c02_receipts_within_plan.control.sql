-- Control for C02: a receipt above the planned amount must be reported. The trigger that
-- would refuse it is disabled inside the transaction. Rolls back.
begin;

alter table public.payment_receipts disable trigger payment_receipts_within_expected;

insert into public.payment_receipts
  (sale_payment_id, amount, received_on, method_id, source, recorded_by, note)
select p.id, p.amount + 1, date '2026-11-19', p.method_id, 'manual', 'control',
       'control: over the planned amount'
from public.sale_payments p
where p.status = 'pending'
order by p.id
limit 1;

select
  p.id as cuota_id,
  p.amount as planned,
  coalesce(sum(r.amount), 0)::numeric(12,2) as received
from public.sale_payments p
left join public.payment_receipts r on r.sale_payment_id = p.id
group by p.id, p.amount
having coalesce(sum(r.amount), 0) > p.amount;

rollback;
