-- 094900_drop_catalog_cost.sql
-- The catalogs kept a `cost` column next to the interval list. After the placeholder run
-- they disagreed: products.cost said 60,90 while the interval said 1,00. Two sources of
-- the same fact, one of them wrong. The interval is the truth; the column goes.
--
-- `catalog_items.current_cost` and `cost_on(kind, item, date)` are the only ways to read
-- a cost. The generated `margin` columns on treatments and services depended on `cost`
-- and are removed with it; the real margin is per sale line.

drop function if exists public.set_item_cost(text, uuid, numeric, date);

alter table public.treatments drop column if exists margin;
alter table public.services   drop column if exists margin;

alter table public.treatments drop column if exists cost_is_estimated;
alter table public.treatments drop column if exists cost;
alter table public.services   drop column if exists cost_is_estimated;
alter table public.services   drop column if exists cost;
alter table public.products   drop column if exists cost_is_estimated;
alter table public.products   drop column if exists cost;

create or replace function public.set_item_cost(
  p_kind    text,
  p_item_id uuid,
  p_cost    numeric,
  p_from    date default current_date
) returns void
language plpgsql
as $$
declare
  v_from date := coalesce(p_from, current_date);
  v_next date;
  v_known boolean;
begin
  if p_kind not in ('treatment', 'product', 'service') then
    raise exception 'unknown item kind %', p_kind using errcode = '22023';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'cost must be zero or positive' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.treatments where id = p_item_id and p_kind = 'treatment'
    union all
    select 1 from public.products where id = p_item_id and p_kind = 'product'
    union all
    select 1 from public.services where id = p_item_id and p_kind = 'service'
  ) then
    raise exception 'item % of kind % does not exist', p_item_id, p_kind using errcode = '23503';
  end if;

  select min(effective_from) into v_next
  from public.item_cost_history
  where item_kind = p_kind and item_id = p_item_id and effective_from > v_from;

  update public.item_cost_history
  set cost = p_cost, note = 'entered by the owner'
  where item_kind = p_kind and item_id = p_item_id and effective_from = v_from;
  v_known := found;

  if not v_known then
    update public.item_cost_history
    set valid_to = v_from - 1
    where item_kind = p_kind and item_id = p_item_id
      and effective_from < v_from and valid_to >= v_from;

    insert into public.item_cost_history
      (item_kind, item_id, cost, effective_from, valid_to, note)
    values
      (p_kind, p_item_id, p_cost, v_from,
       coalesce(v_next - 1, date '9999-12-31'), 'entered by the owner');
  end if;
end;
$$;

comment on function public.set_item_cost(text, uuid, numeric, date) is
  'Defines the cost of an item from a date to the end of time. The catalog has no cost column: the interval is the only source.';

comment on view public.catalog_items is
  'One row per sellable catalog item with its code, list price, the cost in force today and its active flag.';
