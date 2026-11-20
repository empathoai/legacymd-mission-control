-- C13: a voided sale has no receipts and no returns. Voiding means nothing was collected;
-- if money exists, the sale is returned, not voided.
select
  s.id as sale_id,
  s.voided_at,
  exists (
    select 1 from public.payment_receipts r
    join public.sale_payments p on p.id = r.sale_payment_id
    where p.sale_id = s.id
  ) as has_receipts,
  exists (select 1 from public.sale_refunds f where f.sale_id = s.id) as has_returns
from public.sales s
where s.voided_at is not null
  and (
    exists (
      select 1 from public.payment_receipts r
      join public.sale_payments p on p.id = r.sale_payment_id
      where p.sale_id = s.id
    )
    or exists (select 1 from public.sale_refunds f where f.sale_id = s.id)
  )
order by s.id;
