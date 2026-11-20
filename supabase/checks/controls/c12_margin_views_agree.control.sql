-- Control for C12: shift one margin by one peso and the three views must disagree.
-- item_profitability is replaced by a version built on item_monthly_profitability with a
-- one-peso shift, then everything is rolled back.
begin;

create or replace view public.item_profitability as
select
  item_id,
  item_name,
  kind,
  sum(lines)::bigint                                       as lines,
  sum(units)::numeric(12,2)                                as units,
  sum(revenue)::numeric(12,2)                              as revenue,
  bool_and(cost_known)                                     as cost_known,
  sum(cost)::numeric(12,2)                                 as cost,
  (sum(margin) + 1)::numeric(12,2)                         as margin,
  sum(revenue_with_cost)::numeric(12,2)                    as revenue_with_cost
from public.item_monthly_profitability
group by item_id, item_name, kind;

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

rollback;
