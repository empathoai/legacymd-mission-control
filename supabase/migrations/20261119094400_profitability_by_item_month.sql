-- 094400_profitability_by_item_month.sql
-- The report the owner reads is per treatment and per product, accumulated by month.
-- The line is the raw record; this view is the monthly cut.
--
-- It also stops counting revenue with no cost as margin. A line whose unit_cost is null
-- has no known cost, so its revenue is reported in revenue_with_cost only when the cost
-- exists, and margin = revenue_with_cost - cost. The difference is visible, not folded
-- into a margin that looked better than the data supports.

create or replace view public.monthly_pl as
with revenue as (
  select date_trunc('month', sa.occurred_on)::date as month,
         sum(i.line_total)::numeric(12,2) as revenue,
         sum(case when i.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  where sa.voided_at is null
  group by 1
), cogs as (
  select date_trunc('month', sa.occurred_on)::date as month,
         sum(i.line_cost)::numeric(12,2) as cogs
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  where sa.voided_at is null
  group by 1
), spend as (
  select p.period as month, sum(e.amount)::numeric(12,2) as expenses
  from public.expense_periods p
  join public.expense_entries e on e.period_id = p.id
  group by 1
)
select
  coalesce(r.month, c.month, s.month)                     as month,
  coalesce(r.revenue, 0)                                  as revenue,
  coalesce(c.cogs, 0)                                     as cogs,
  coalesce(r.revenue_with_cost, 0) - coalesce(c.cogs, 0)  as gross_margin,
  coalesce(s.expenses, 0)                                 as expenses,
  coalesce(r.revenue, 0) - coalesce(s.expenses, 0)       as cash_result,
  coalesce(r.revenue_with_cost, 0)                        as revenue_with_cost
from revenue r
full join cogs c on c.month = r.month
full join spend s on s.month = coalesce(r.month, c.month)
order by 1;

comment on view public.monthly_pl is
  'Revenue, frozen COGS and cash expenses. gross_margin uses revenue_with_cost, so a line without a cost never produces a margin. cash_result subtracts expenses only.';

create or replace view public.item_profitability as
select
  i_item.id        as item_id,
  i_item.name      as item_name,
  i_item.kind,
  i_item.lines,
  i_item.units,
  i_item.revenue,
  i_item.cost_known,
  i_item.cost,
  (i_item.revenue_with_cost - i_item.cost)::numeric(12,2) as margin,
  i_item.revenue_with_cost
from (
  select
    coalesce(t.id, p.id, s.id)                                   as id,
    coalesce(t.name, p.name, s.name, i.description)              as name,
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
    sum(case when i.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  left join public.treatments t on t.id = i.treatment_id
  left join public.products p on p.id = i.product_id
  left join public.services s on s.id = i.service_id
  where sa.voided_at is null
  group by 1, 2, 3
) i_item;

comment on view public.item_profitability is
  'Per catalog item over the whole history: revenue, frozen cost and margin. margin uses revenue_with_cost, so lines without a cost do not inflate it.';

create or replace view public.profitability_by_kind as
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
  (sum(case when i.unit_cost is not null then i.line_total else 0 end) - sum(i.line_cost))::numeric(12,2) as margin,
  sum(case when i.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sales sa on sa.id = i.sale_id
where sa.voided_at is null
group by 1, 2;

create or replace view public.profitability_by_category as
select
  date_trunc('month', sa.occurred_on)::date                       as month,
  coalesce(c.slug, 'uncategorised')                               as category,
  coalesce(c.label, 'Uncategorised')                              as category_label,
  count(*)                                                        as lines,
  sum(i.line_total)::numeric(12,2)                                as revenue,
  sum(i.line_cost)::numeric(12,2)                                 as cost,
  (sum(case when i.unit_cost is not null then i.line_total else 0 end) - sum(i.line_cost))::numeric(12,2) as margin,
  round(100.0 * (sum(case when i.unit_cost is not null then i.line_total else 0 end) - sum(i.line_cost))
        / nullif(sum(case when i.unit_cost is not null then i.line_total else 0 end), 0), 1) as margin_pct,
  sum(case when i.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost
from public.sale_items i
join public.sales sa on sa.id = i.sale_id
left join public.categories c on c.id = i.category_id
where sa.voided_at is null
group by 1, 2, 3;

create or replace view public.product_performance as
select
  p.id,
  p.name,
  p.price,
  p.cost,
  count(i.id)                                                     as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                     as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)                   as revenue,
  coalesce(sum(i.line_cost), 0)::numeric(12,2)                    as total_cost,
  (coalesce(sum(case when i.unit_cost is not null then i.line_total else 0 end), 0)
    - coalesce(sum(i.line_cost), 0))::numeric(12,2)               as margin,
  coalesce(sum(case when i.unit_cost is not null then i.line_total else 0 end), 0)::numeric(12,2) as revenue_with_cost
from public.products p
left join public.sale_items i on i.product_id = p.id
group by p.id, p.name, p.price, p.cost;

create or replace view public.treatment_performance as
select
  t.id,
  t.name,
  t.price,
  t.cost,
  count(i.id)                                                     as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                     as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)                   as revenue,
  coalesce(sum(i.line_cost), 0)::numeric(12,2)                    as total_cost,
  (coalesce(sum(case when i.unit_cost is not null then i.line_total else 0 end), 0)
    - coalesce(sum(i.line_cost), 0))::numeric(12,2)               as margin,
  coalesce(sum(case when i.unit_cost is not null then i.line_total else 0 end), 0)::numeric(12,2) as revenue_with_cost
from public.treatments t
left join public.sale_items i on i.treatment_id = t.id
group by t.id, t.name, t.price, t.cost;

create or replace view public.services_performance as
select
  s.id,
  s.name,
  s.price,
  s.cost,
  count(i.id)                                                     as lines,
  coalesce(sum(i.quantity), 0)::numeric(12,2)                     as units,
  coalesce(sum(i.line_total), 0)::numeric(12,2)                   as revenue,
  coalesce(sum(i.line_cost), 0)::numeric(12,2)                    as total_cost,
  (coalesce(sum(case when i.unit_cost is not null then i.line_total else 0 end), 0)
    - coalesce(sum(i.line_cost), 0))::numeric(12,2)               as margin,
  coalesce(sum(case when i.unit_cost is not null then i.line_total else 0 end), 0)::numeric(12,2) as revenue_with_cost
from public.services s
left join public.sale_items i on i.service_id = s.id
group by s.id, s.name, s.price, s.cost;

create view public.item_monthly_profitability with (security_invoker = true) as
select
  date_trunc('month', sa.occurred_on)::date                    as month,
  coalesce(t.id, p.id, sv.id)                                  as item_id,
  coalesce(t.name, p.name, sv.name, i.description)             as item_name,
  case
    when t.id is not null then 'treatment'
    when p.id is not null then 'product'
    when sv.id is not null then 'service'
    else 'unmapped'
  end                                                          as kind,
  count(*)                                                     as lines,
  sum(i.quantity)::numeric(12,2)                               as units,
  sum(i.line_total)::numeric(12,2)                             as revenue,
  sum(i.line_cost)::numeric(12,2)                              as cost,
  sum(case when i.unit_cost is not null then i.line_total else 0 end)::numeric(12,2) as revenue_with_cost,
  (sum(case when i.unit_cost is not null then i.line_total else 0 end)
    - sum(i.line_cost))::numeric(12,2)                         as margin,
  round(100.0 * (sum(case when i.unit_cost is not null then i.line_total else 0 end) - sum(i.line_cost))
        / nullif(sum(case when i.unit_cost is not null then i.line_total else 0 end), 0), 1) as margin_pct,
  bool_and(i.unit_cost is not null)                            as cost_known
from public.sale_items i
join public.sales sa on sa.id = i.sale_id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services sv on sv.id = i.service_id
where sa.voided_at is null
group by 1, 2, 3, 4;

comment on view public.item_monthly_profitability is
  'The report: revenue, frozen cost and margin per treatment and per product, accumulated by month. margin uses revenue_with_cost, so a line without a cost stays visible as revenue and contributes no margin.';
