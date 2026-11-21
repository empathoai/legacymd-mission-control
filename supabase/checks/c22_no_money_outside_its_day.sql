-- C22: nothing money-shaped is dated outside the sale it belongs to, or in the future.
-- The triggers refuse these writes; this check proves no row got in through a path that
-- bypassed them (a migration, a restore, a disabled trigger).
select 'sale' as what, s.id::text as id, s.occurred_on::text as day
from public.sales s
where s.occurred_on > current_date
   or (s.billed_at is not null
       and (s.billed_at at time zone 'America/New_York')::date < s.occurred_on)
union all
select 'installment', p.id::text, p.due_on::text
from public.sale_payments p
join public.sales s on s.id = p.sale_id
where p.due_on < s.occurred_on
union all
select 'receipt', r.id::text, r.received_on::text
from public.payment_receipts r
join public.sale_payments p on p.id = r.sale_payment_id
join public.sales s on s.id = p.sale_id
where r.received_on > current_date
   or r.received_on < s.occurred_on
union all
select 'return', f.id::text, f.refunded_on::text
from public.sale_refunds f
join public.sales s on s.id = f.sale_id
where f.refunded_on > current_date
   or f.refunded_on < s.occurred_on
   or (f.state = 'refunded'
       and f.refunded_at is not null
       and (f.refunded_at::date < f.refunded_on or f.refunded_at::date > current_date));
