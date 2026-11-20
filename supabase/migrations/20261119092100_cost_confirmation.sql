-- 20261119092100_cost_confirmation.sql
-- The form shows the product's reference cost and asks "is this the same?".
-- When the owner confirms or edits it, the line records that the cost was
-- confirmed by a person, not defaulted. That distinction is what makes the
-- margin reportable later.

alter table public.sale_items add column if not exists cost_confirmed boolean not null default false;
alter table public.sale_items add column if not exists cost_source text
  check (cost_source is null or cost_source in ('catalog', 'edited', 'unknown'));

comment on column public.sale_items.cost_confirmed is 'True when a person confirmed or typed the cost on this line.';
comment on column public.sale_items.cost_source is 'catalog = reference accepted, edited = typed by hand, unknown = no cost available.';

-- everything imported so far used a catalog reference nobody confirmed
update public.sale_items set cost_source = 'catalog' where cost_source is null;
