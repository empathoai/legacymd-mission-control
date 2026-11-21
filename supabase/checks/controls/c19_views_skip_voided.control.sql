-- Control for C19: simulate the regression, then prove the check sees it.
-- 1. A voided sale worth 500 is created.
-- 2. `sales_with_totals` is recreated without its `voided_at is null` filter — the exact
--    shape that made `monthly_balance` count a cancelled sale.
-- 3. C19 must report the disagreement. Everything rolls back.
begin;

with new_sale as (
  insert into public.sales
    (occurred_on, customer_id, is_first_visit, visit_number, billed_at, billed_at_source,
     voided_at, void_reason, voided_by)
  select date '2026-10-15', id, false, null, now(), 'live', now(), 'control', 'control'
  from public.customers
  order by id
  limit 1
  returning id
)
insert into public.sale_items
  (sale_id, description, quantity, unit_price, list_price)
select id, 'control voided sale', 1, 500, 500 from new_sale;

create or replace view public.sales_with_totals
with (security_invoker = true) as
select s.id,
       s.occurred_on,
       s.customer_id,
       s.source_id,
       s.is_first_visit,
       s.notes,
       coalesce(sum(i.line_total), 0)::numeric(12,2) as total
from public.sales s
left join public.sale_items i on i.sale_id = s.id
group by s.id;

with canonical as (
  select date_trunc('month', s.occurred_on::timestamptz)::date as month,
         sum(i.line_total) as revenue
  from public.sale_items i
  join public.sales s on s.id = i.sale_id
  where s.voided_at is null
  group by 1
),
mb as (
  select month, revenue from public.monthly_balance
),
dby as (
  select month, charged as revenue from public.discount_by_month
),
rbc as (
  select month, sum(revenue) as revenue from public.revenue_by_category group by 1
)
select 'monthly_balance' as view_name,
       coalesce(mb.month, c.month) as month,
       mb.revenue as view_value,
       c.revenue as expected
from mb
full join canonical c on c.month = mb.month
where mb.revenue is distinct from c.revenue
union all
select 'discount_by_month',
       coalesce(d.month, c.month),
       d.revenue,
       c.revenue
from dby d
full join canonical c on c.month = d.month
where d.revenue is distinct from c.revenue
union all
select 'revenue_by_category',
       coalesce(r.month, c.month),
       r.revenue,
       c.revenue
from rbc r
full join canonical c on c.month = r.month
where r.revenue is distinct from c.revenue
order by 1, 2;

rollback;
