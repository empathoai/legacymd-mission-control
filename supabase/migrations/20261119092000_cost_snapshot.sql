-- 20261119092000_cost_snapshot.sql
-- A catalog cost is not a fact about the past: it changes (Tirzepatide dropped
-- ~50% in the US and the sale price did not). If margins read the live catalog,
-- every cost update rewrites history.
-- Each sale line now keeps the unit cost it was measured with, and the catalog
-- gains a cost history so the app can pick the cost effective on the sale date.

alter table public.sale_items add column if not exists unit_cost numeric(10,2) check (unit_cost >= 0);

alter table public.sale_items
  add column if not exists line_cost numeric(12,2)
  generated always as (coalesce(unit_cost, 0) * quantity) stored;

alter table public.sale_items
  add column if not exists line_margin numeric(12,2)
  generated always as ((unit_price - coalesce(unit_cost, 0)) * quantity) stored;

comment on column public.sale_items.unit_cost is 'Cost per unit at sale time. Null when the catalog had no cost that day.';
comment on column public.sale_items.line_margin is 'line_total - line_cost. Frozen with the line: later catalog changes do not touch it.';

-- backfill from the catalog as it stands today (flagged as estimated where it was)
update public.sale_items i
set unit_cost = coalesce(
  (select t.cost from public.treatments t where t.id = i.treatment_id),
  (select p.cost from public.products p where p.id = i.product_id),
  (select s.cost from public.services s where s.id = i.service_id)
)
where i.unit_cost is null;

create table if not exists public.item_cost_history (
  id             uuid primary key default gen_random_uuid(),
  item_kind      text not null check (item_kind in ('treatment', 'product', 'service')),
  item_id        uuid not null,
  cost           numeric(10,2) not null check (cost >= 0),
  effective_from date not null,
  note           text,
  created_at     timestamptz not null default now(),
  unique (item_kind, item_id, effective_from)
);

comment on table public.item_cost_history is 'Cost over time per catalog item. A sale uses the row effective on its date.';

-- seed the history with today's known cost so the app has a starting point
insert into public.item_cost_history (item_kind, item_id, cost, effective_from, note)
select 'treatment', id, cost, date '2026-05-01', 'catalog cost, no real effective date'
from public.treatments where cost is not null
on conflict do nothing;

insert into public.item_cost_history (item_kind, item_id, cost, effective_from, note)
select 'product', id, cost, date '2026-05-01', 'catalog cost, no real effective date'
from public.products where cost is not null
on conflict do nothing;

insert into public.item_cost_history (item_kind, item_id, cost, effective_from, note)
select 'service', id, cost, date '2026-05-01', 'catalog cost, no real effective date'
from public.services where cost is not null
on conflict do nothing;
