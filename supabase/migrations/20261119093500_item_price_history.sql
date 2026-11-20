-- 093500_item_price_history.sql
-- The twin of item_cost_history, for list prices. The cost table truncates effective_from
-- to the first of the month, so two changes in one month collide; this one keeps the real
-- date. Only the cutover onwards is verified: the historical seed has no real date.

create table if not exists public.item_price_history (
  id             uuid primary key default gen_random_uuid(),
  item_kind      text not null check (item_kind in ('treatment', 'product', 'service')),
  item_id        uuid not null,
  price          numeric(10,2) not null check (price >= 0),
  effective_from date not null,
  note           text,
  created_at     timestamptz not null default now(),
  unique (item_kind, item_id, effective_from)
);

comment on table public.item_price_history is
  'List price over time per catalog item. A sale freezes the price it saw; this table proves what that price was.';

insert into public.item_price_history (item_kind, item_id, price, effective_from, note)
select 'treatment', id, price, date '2026-05-01', 'catalog price, no real effective date'
from public.treatments where price is not null
on conflict (item_kind, item_id, effective_from) do nothing;

insert into public.item_price_history (item_kind, item_id, price, effective_from, note)
select 'product', id, price, date '2026-05-01', 'catalog price, no real effective date'
from public.products where price is not null
on conflict (item_kind, item_id, effective_from) do nothing;

insert into public.item_price_history (item_kind, item_id, price, effective_from, note)
select 'service', id, price, date '2026-05-01', 'catalog price, no real effective date'
from public.services where price is not null
on conflict (item_kind, item_id, effective_from) do nothing;
