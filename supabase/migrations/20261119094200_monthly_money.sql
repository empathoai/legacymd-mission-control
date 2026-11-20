-- 094200_monthly_money.sql
-- One row per month: gross revenue, what came back, what was adjusted, net revenue and
-- money collected. monthly_pl stays the gross/cogs view so C12 keeps comparing like with
-- like; this is the view the owner reads for "how much came in".

create view public.monthly_money with (security_invoker = true) as
with rev as (
  select month, revenue from public.monthly_pl
), ret as (
  select date_trunc('month', refunded_on)::date as month,
         sum(amount)::numeric(12,2) as returned
  from public.sale_refunds
  group by 1
), adj as (
  select date_trunc('month', occurred_on)::date as month,
         sum(revenue_delta)::numeric(12,2) as revenue_delta,
         sum(cash_delta)::numeric(12,2) as cash_delta
  from public.adjustments
  group by 1
), col as (
  select month, collected from public.cash_collected
)
select
  coalesce(rev.month, ret.month, adj.month, col.month)      as month,
  coalesce(rev.revenue, 0)::numeric(12,2)                   as gross_revenue,
  coalesce(ret.returned, 0)::numeric(12,2)                  as returned,
  coalesce(adj.revenue_delta, 0)::numeric(12,2)             as adjustment_revenue,
  coalesce(adj.cash_delta, 0)::numeric(12,2)                as adjustment_cash,
  (coalesce(rev.revenue, 0)
    - coalesce(ret.returned, 0)
    + coalesce(adj.revenue_delta, 0))::numeric(12,2)        as net_revenue,
  coalesce(col.collected, 0)::numeric(12,2)                 as collected
from rev
full join ret on ret.month = rev.month
full join adj on adj.month = coalesce(rev.month, ret.month)
full join col on col.month = coalesce(rev.month, ret.month, adj.month)
order by 1;

comment on view public.monthly_money is
  'Per month: gross revenue from sale lines, returns, adjustment revenue, net revenue, and money collected by bank date. monthly_pl keeps gross revenue and cogs.';
