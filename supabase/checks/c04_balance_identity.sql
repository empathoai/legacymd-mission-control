-- C04: the balance in the view equals an independent recomputation from base tables.
-- The two are written with separate paths on purpose: a view that drops a term still
-- returns a number, and only a second computation catches it.
with sold as (
  select s.customer_id, sum(i.line_total) as v
  from public.sales s join public.sale_items i on i.sale_id = s.id
  where s.voided_at is null group by 1
), collected as (
  select s.customer_id, sum(r.amount) as v
  from public.payment_receipts r
  join public.sale_payments p on p.id = r.sale_payment_id
  join public.sales s on s.id = p.sale_id
  where s.voided_at is null group by 1
), adjusted as (
  select customer_id, sum(revenue_delta) as rev, sum(cash_delta) as cash
  from public.adjustments where customer_id is not null group by 1
), owed_back as (
  select s.customer_id, sum(r.amount) as v
  from public.sale_refunds r join public.sales s on s.id = r.sale_id
  where r.state = 'pending' group by 1
)
select
  b.id,
  b.balance,
  (coalesce(sd.v, 0) + coalesce(a.rev, 0) - coalesce(a.cash, 0)
    - coalesce(co.v, 0) - coalesce(ob.v, 0))::numeric(12,2) as recomputed
from public.customer_balances b
left join sold sd on sd.customer_id = b.id
left join collected co on co.customer_id = b.id
left join adjusted a on a.customer_id = b.id
left join owed_back ob on ob.customer_id = b.id
where b.balance is distinct from
      (coalesce(sd.v, 0) + coalesce(a.rev, 0) - coalesce(a.cash, 0)
        - coalesce(co.v, 0) - coalesce(ob.v, 0))::numeric(12,2)
order by b.id;
