-- C12: the margin computed three ways must agree.
-- item_profitability groups by item, item_monthly_profitability by item and month, and
-- monthly_pl by month. All three derive from the same lines, so their totals must match,
-- and each must equal revenue_with_cost minus cost. A view that folds revenue without a
-- cost into the margin breaks this and nothing else.
with items as (
  select
    round(coalesce(sum(margin), 0), 2)                             as margin_items,
    round(coalesce(sum(revenue_with_cost), 0) - coalesce(sum(cost), 0), 2) as identity_items
  from public.item_profitability
), monthly as (
  select
    round(coalesce(sum(margin), 0), 2)                             as margin_monthly,
    round(coalesce(sum(revenue_with_cost), 0) - coalesce(sum(cost), 0), 2) as identity_monthly
  from public.item_monthly_profitability
), pl as (
  select
    round(coalesce(sum(gross_margin), 0), 2)                       as margin_pl,
    round(coalesce(sum(revenue_with_cost), 0) - coalesce(sum(cogs), 0), 2) as identity_pl
  from public.monthly_pl
)
select items.*, monthly.*, pl.*
from items, monthly, pl
where items.margin_items <> items.identity_items
   or monthly.margin_monthly <> monthly.identity_monthly
   or pl.margin_pl <> pl.identity_pl
   or items.margin_items <> monthly.margin_monthly
   or items.margin_items <> pl.margin_pl;
