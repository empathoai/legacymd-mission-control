-- 100600_price_intervals.sql
-- The list price is an interval too: a row per item and start date in
-- item_price_history, and the price in force is the latest row on or before the day.
-- Editing a price inserts a row; the catalog column follows only when the change applies
-- today or earlier, exactly like the cost column did before it was removed.

create unique index if not exists item_price_history_slot_uk
  on public.item_price_history (item_kind, item_id, effective_from);

create or replace function public.price_on(
  p_kind    text,
  p_item_id uuid,
  p_at      date
) returns numeric
language sql stable
as $$
  select h.price
  from public.item_price_history h
  where h.item_kind = p_kind
    and h.item_id = p_item_id
    and h.effective_from <= p_at
  order by h.effective_from desc
  limit 1
$$;

comment on function public.price_on(text, uuid, date) is
  'The list price in force for an item on a day. Null when no interval covers it.';

create or replace view public.catalog_items with (security_invoker = true) as
select
  'treatment'::text                                    as item_kind,
  t.id                                                  as item_id,
  t.code,
  t.name,
  coalesce(public.price_on('treatment', t.id, current_date), t.price)::numeric(10,2) as price,
  public.cost_at('treatment', t.id, now())              as current_cost,
  t.active,
  t.unit_type
from public.treatments t
union all
select
  'product'::text,
  p.id,
  p.code,
  p.name,
  coalesce(public.price_on('product', p.id, current_date), p.price)::numeric(10,2),
  public.cost_at('product', p.id, now()),
  p.active,
  null::text
from public.products p
union all
select
  'service'::text,
  s.id,
  s.code,
  s.name,
  coalesce(public.price_on('service', s.id, current_date), s.price)::numeric(10,2),
  public.cost_at('service', s.id, now()),
  s.active,
  null::text
from public.services s;

comment on view public.catalog_items is
  'One row per sellable catalog item: the price in force today, the cost in force today, and the active flag.';

create or replace function public.set_item_price(
  p_kind    text,
  p_item_id uuid,
  p_price   numeric,
  p_from    date default current_date,
  p_note    text default null
) returns void
language plpgsql
as $$
declare
  v_table text;
  v_from  date := coalesce(p_from, current_date);
begin
  if p_kind not in ('treatment', 'product', 'service') then
    raise exception 'unknown item kind %', p_kind using errcode = '22023';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'price must be zero or positive' using errcode = '22023';
  end if;

  if p_kind = 'treatment' then
    v_table := 'treatments';
  elsif p_kind = 'product' then
    v_table := 'products';
  else
    v_table := 'services';
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

  insert into public.item_price_history (item_kind, item_id, price, effective_from, note)
  values (p_kind, p_item_id, p_price, v_from, p_note)
  on conflict (item_kind, item_id, effective_from)
  do update set price = excluded.price, note = excluded.note;

  if v_from <= current_date then
    execute format('update public.%I set price = $1 where id = $2', v_table)
      using p_price, p_item_id;
  end if;
end;
$$;

comment on function public.set_item_price(text, uuid, numeric, date, text) is
  'Sets the list price from a date and moves the catalog column only when the change applies today or earlier.';
