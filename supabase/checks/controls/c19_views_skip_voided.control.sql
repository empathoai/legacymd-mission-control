-- Control for C19: a monthly_pl recreated without the voided filter must be reported.
begin;

create or replace view public.monthly_pl with (security_invoker = true) as
with revenue as (
  select date_trunc('month', lc.occurred_on)::date as month,
         sum(i.line_total)::numeric(12,2) as revenue,
         sum(case when lc.unit_cost is not null then i.line_total else 0 end)::numeric(12,2)
           as revenue_with_cost
  from public.sale_items i
  join public.sale_line_cost lc on lc.sale_item_id = i.id
  group by 1
), cogs as (
  select date_trunc('month', lc.occurred_on)::date as month,
         sum(i.quantity * coalesce(lc.unit_cost, 0))::numeric(12,2) as cogs
  from public.sale_items i
  join public.sale_line_cost lc on lc.sale_item_id = i.id
  group by 1
), spend as (
  select p.period as month, sum(e.amount)::numeric(12,2) as expenses
  from public.expense_periods p
  join public.expense_entries e on e.period_id = p.id
  group by p.period
)
select coalesce(r.month, c.month, s.month) as month,
       coalesce(r.revenue, 0) as revenue,
       coalesce(c.cogs, 0) as cogs,
       (coalesce(r.revenue_with_cost, 0) - coalesce(c.cogs, 0)) as gross_margin,
       coalesce(s.expenses, 0) as expenses,
       (coalesce(r.revenue, 0) - coalesce(s.expenses, 0)) as cash_result,
       coalesce(r.revenue_with_cost, 0) as revenue_with_cost
from revenue r
full join cogs c on c.month = r.month
full join spend s on s.month = coalesce(r.month, c.month)
order by coalesce(r.month, c.month, s.month);

select v.view_name
from (values
  ('expense_by_category'),
  ('monthly_pl'),
  ('monthly_balance')
) as v(view_name)
where pg_get_viewdef(('public.' || v.view_name)::regclass) not ilike '%voided_at is null%';

rollback;
