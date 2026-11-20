-- C16: the balance list only holds customers with at least one money fact.
select b.id, b.full_name
from public.customer_balances b
where not exists (select 1 from public.sales s where s.customer_id = b.id)
  and not exists (select 1 from public.adjustments a where a.customer_id = b.id)
  and not exists (
    select 1
    from public.payment_receipts r
    join public.sale_payments p on p.id = r.sale_payment_id
    join public.sales s on s.id = p.sale_id
    where s.customer_id = b.id
  )
  and not exists (
    select 1
    from public.sale_refunds f
    join public.sales s on s.id = f.sale_id
    where s.customer_id = b.id
  )
order by b.full_name;
