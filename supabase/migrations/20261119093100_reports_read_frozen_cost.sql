-- 20261119093100_reports_read_frozen_cost.sql
-- Every margin view computed cost from the live catalog while the sale line froze its
-- own unit_cost. The decision says a line keeps the cost it was measured with, but the
-- reports ignored it: replacing the $1.00 product placeholder would have rewritten
-- historical product margins overnight while the frozen columns disagreed.
--
-- From here the margin views read sale_items.line_cost. The catalog cost stays visible
-- as the current default, never as the historical measurement. cost_known now means
-- "this line was measured with a cost", which is what a reader needs to trust a margin.

drop view if exists public.item_profitability;
drop view if exists public.monthly_pl;
drop view if exists public.profitability_by_kind;
drop view if exists public.profitability_by_category;
drop view if exists public.product_performance;
drop view if exists public.treatment_performance;
drop view if exists public.services_performance;

create view public.item_profitability with (security_invoker = true) as
select
  coalesce(t.id, p.id, s.id)                                   as item_id,
  coalesce(t.name, p.name, s.name, i.description)              as item_name,
  case
    when t.id is not null then 'treatment'
    when p.id is not null then 'product'
    when s.id is not null then 'service'
    else 'unmapped'
  end                                                          as kind,
  count(*)                                                     as lines,
  sum(i.quantity)::numeric(12,2)                               as units,
  sum(i.line_total)::numeric(12,2)                             as revenue,
  bool_and(i.unit_cost is not null)                            as cost_known,
  sum(i.line_cost)::numeric(12,2)                              as cost,
  (sum(i.line_total) - sum(i.line_cost))::numeric(12,2)        as margin
from public.sale_items i
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services s on s.id = i.service_id
group by 1, 2, 3;

comment on view public.item_profitability is 'Revenue, frozen cost and margin per catalog item. cost_known = false means the line was stored without a cost.';

create view public.monthly_pl with (security_invoker = true) as
with revenue as (
  select date_trunc('month', occurred_on)::date as month,
         sum(total)::numeric(12,2) as revenue
  from public.sales_with_totals
  group by 1
), cogs as (
  select date_trunc('month', sa.occurred_on)::date as month,
         sum(i.line_cost)::numeric(12,2) as cogs
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  group by 1
), spend as (
  select p.period as month, sum(e.amount)::numeric(12,2) as expenses
  from public.expense_periods p
  join public.expense_entries e on e.period_id = p.id
  group by 1
)
select
  coalesce(r.month, c.month, s.month)                  as month,
  coalesce(r.revenue, 0)                               as revenue,
  coalesce(c.cogs, 0)                                  as cogs,
  coalesce(r.revenue, 0) - coalesce(c.cogs, 0)         as gross_margin,
  coalesce(s.expenses, 0)                              as expenses,
  coalesce(r.revenue, 0) - coalesce(s.expenses, 0)     as cash_result
from revenue r
full join cogs c on c.month = r.month
full join spend s on s.month = coalesce(r.month, c.month)
order by 1;

comment on view public.monthly_pl is
  'Revenue, frozen COGS and cash expenses. cash_result subtracts expenses only: the Products expense already records purchases, so subtracting COGS twice would double count. gross_margin is the unit-economics figure, computed from the cost frozen on each line.';

create view public.profitability_by_kind with (security_invoker = true) as
select
  date_trunc('month', sa.occurred_on)::date                       as month,
  case
    when i.treatment_id is not null then 'treatment'
    when i.product_id is not null then 'product'
    when i.service_id is not null then 'service'
    else 'unmapped'
  end                                                             as kind,
  count(*)                                                        as lines,
  sum(i.quantity)::numeric(12,2)                                  as units,
  sum(i.line_total)::numeric(12,2)                                as revenue,
  sum(i.line_cost)::numeric(12,2)                                 as cost,
  (sum(i.line_total) - sum(i.line_cost))::numeric(12,2)           as margin,
  sum(case when i.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sales sa on sa.id = i.sale_id
group by 1, 2;

comment on view public.profitability_by_kind is 'Monthly revenue, frozen cost and margin split into treatments, products and services.';

create view public.profitability_by_category with (security_invoker = true) as
select
  date_trunc('month', sa.occurred_on)::date                       as month,
  coalesce(c.slug, 'uncategorised')                               as category,
  coalesce(c.label, 'Uncategorised')                              as category_label,
  count(*)                                                        as lines,
  sum(i.line_total)::numeric(12,2)                                as revenue,
  sum(i.line_cost)::numeric(12,2)                                 as cost,
  (sum(i.line_total) - sum(i.line_cost))::numeric(12,2)           as margin,
  round(100.0 * (sum(i.line_total) - sum(i.line_cost)) / nullif(sum(i.line_total), 0), 1) as margin_pct,
  sum(case when i.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sales sa on sa.id = i.sale_id
left join public.categories c on c.id = i.category_id
group by 1, 2, 3;

comment on view public.profitability_by_category is 'Monthly revenue, frozen cost and margin per sale category.';

create view public.product_performance with (security_invoker = true) as
select
  p.id,
  p.name,
  p.price,
  p.cost,
  count(i.id)                                                     as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                     as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)                   as revenue,
  coalesce(sum(i.line_cost), 0)::numeric(12,2)                    as total_cost,
  (coalesce(sum(i.line_total), 0) - coalesce(sum(i.line_cost), 0))::numeric(12,2) as margin
from public.products p
left join public.sale_items i on i.product_id = p.id
group by p.id, p.name, p.price, p.cost;

comment on view public.product_performance is 'Products sold: units, revenue and margin from the frozen line cost, including products never sold. cost is the current catalog cost.';

create view public.treatment_performance with (security_invoker = true) as
select
  t.id,
  t.name,
  t.price,
  t.cost,
  count(i.id)                                                     as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                     as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)                   as revenue,
  coalesce(sum(i.line_cost), 0)::numeric(12,2)                    as total_cost,
  (coalesce(sum(i.line_total), 0) - coalesce(sum(i.line_cost), 0))::numeric(12,2) as margin
from public.treatments t
left join public.sale_items i on i.treatment_id = t.id
group by t.id, t.name, t.price, t.cost;

comment on view public.treatment_performance is 'Treatments sold: units, revenue and margin from the frozen line cost, including treatments never sold. cost is the current catalog cost.';

create view public.services_performance with (security_invoker = true) as
select
  s.id,
  s.name,
  s.price,
  s.cost,
  count(i.id)                                                     as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                     as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)                   as revenue,
  coalesce(sum(i.line_cost), 0)::numeric(12,2)                    as total_cost,
  (coalesce(sum(i.line_total), 0) - coalesce(sum(i.line_cost), 0))::numeric(12,2) as margin
from public.services s
left join public.sale_items i on i.service_id = s.id
group by s.id, s.name, s.price, s.cost;

comment on view public.services_performance is 'Services sold: units, revenue and margin from the frozen line cost. cost is the current catalog cost.';
