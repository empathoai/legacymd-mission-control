-- C03: the money returned for a sale never exceeds the money collected for it.
select
  s.id as sale_id,
  (select coalesce(sum(r.amount), 0) from public.sale_refunds r where r.sale_id = s.id)::numeric(12,2) as returned,
  (select coalesce(sum(rc.amount), 0)
     from public.payment_receipts rc
     join public.sale_payments p on p.id = rc.sale_payment_id
    where p.sale_id = s.id)::numeric(12,2) as collected
from public.sales s
where (select coalesce(sum(r.amount), 0) from public.sale_refunds r where r.sale_id = s.id)
    > (select coalesce(sum(rc.amount), 0)
         from public.payment_receipts rc
         join public.sale_payments p on p.id = rc.sale_payment_id
        where p.sale_id = s.id)
order by s.id;
