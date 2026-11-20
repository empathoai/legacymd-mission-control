-- C02: receipts on an installment never exceed its planned amount.
select
  p.id as cuota_id,
  p.amount as planned,
  coalesce(sum(r.amount), 0)::numeric(12,2) as received
from public.sale_payments p
left join public.payment_receipts r on r.sale_payment_id = p.id
group by p.id, p.amount
having coalesce(sum(r.amount), 0) > p.amount
order by coalesce(sum(r.amount), 0) - p.amount desc;
