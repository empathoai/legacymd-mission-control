-- C19: no view counts a voided sale.
--
-- The first version searched the view definitions for the text "voided_at is null".
-- `monthly_balance` contains that text in its expense CTE while its revenue came from
-- `sales_with_totals`, which did not filter: the check passed and the revenue was wrong.
-- This version compares numbers instead of words.
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
