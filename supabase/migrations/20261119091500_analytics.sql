-- 20261119091500_analytics.sql
-- Three views, three questions:
--   item_profitability    what each thing sold leaves after its cost
--   marketing_performance what the ad spend bought, and what a new patient costs
--   monthly_pl            revenue, cash expenses and result for the month
--
-- Cost basis: the catalog cost per unit times the quantity sold. Lines without a
-- catalog cost are reported as `cost_known = false` instead of assumed zero, so a
-- margin never looks better than the data supports.

create or replace view public.item_profitability as
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
  (coalesce(t.cost, p.cost, s.cost) is not null)               as cost_known,
  sum(i.quantity * coalesce(t.cost, p.cost, s.cost))::numeric(12,2) as cost,
  (sum(i.line_total) - sum(i.quantity * coalesce(t.cost, p.cost, s.cost)))::numeric(12,2) as margin
from public.sale_items i
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services s on s.id = i.service_id
group by 1, 2, 3, 7;

comment on view public.item_profitability is 'Revenue, cost and margin per catalog item. cost_known = false means the catalog has no cost for it.';

create or replace view public.marketing_performance as
with spend as (
  select p.period as month, sum(e.amount)::numeric(12,2) as ad_spend
  from public.expense_entries e
  join public.expense_periods p on p.id = e.period_id
  join public.expense_items i on i.id = e.item_id
  where i.normalized_name = 'advertising'
  group by 1
), new_patients as (
  select date_trunc('month', occurred_on)::date as month,
         count(*) filter (where is_first_visit) as patients,
         sum(total) filter (where is_first_visit)::numeric(12,2) as revenue_new,
         sum(total)::numeric(12,2) as revenue_all,
         count(*) as visits
  from public.sales_with_totals
  group by 1
)
select
  coalesce(s.month, n.month)                     as month,
  coalesce(s.ad_spend, 0)                        as ad_spend,
  coalesce(n.patients, 0)                        as new_patients,
  coalesce(n.revenue_new, 0)                     as revenue_new_patients,
  coalesce(n.revenue_all, 0)                     as revenue_total,
  coalesce(n.visits, 0)                          as visits,
  round(coalesce(s.ad_spend, 0) / nullif(n.patients, 0), 2)          as cost_per_new_patient,
  round(coalesce(n.revenue_new, 0) / nullif(s.ad_spend, 0), 2)       as revenue_per_ad_dollar,
  round(coalesce(n.revenue_all, 0) / nullif(s.ad_spend, 0), 2)       as total_revenue_per_ad_dollar
from spend s
full join new_patients n on n.month = s.month
order by 1;

comment on view public.marketing_performance is 'Ad spend against new patients and revenue, month by month.';

create or replace view public.monthly_pl as
with revenue as (
  select date_trunc('month', occurred_on)::date as month,
         sum(total)::numeric(12,2) as revenue
  from public.sales_with_totals
  group by 1
), cogs as (
  select date_trunc('month', sa.occurred_on)::date as month,
         sum(i.quantity * coalesce(t.cost, p.cost, s.cost))::numeric(12,2) as cogs
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  left join public.treatments t on t.id = i.treatment_id
  left join public.products p on p.id = i.product_id
  left join public.services s on s.id = i.service_id
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
  'Revenue, estimated COGS and cash expenses. cash_result subtracts expenses only: the Products expense already records purchases, so subtracting COGS twice would double count. gross_margin is the unit-economics figure.';
