-- 20261122120000_set_item_price_guard.sql
-- The review's third data finding: a price change dated in the past rewrote the catalog
-- column even when a newer interval already existed. `set_item_price('treatment', PCK-0002,
-- 1.00, '2026-01-01')` left the catalog at 1,00 while `price_on(today)` answered 357,00 —
-- exactly the drift C20 exists to catch, produced by the function C20 protects.
--
-- The column follows the newest interval, so it is written only when the interval being set
-- is the newest one. A backdated correction still changes the history and therefore the
-- margin of the past; it no longer moves the price the desk reads today.

create or replace function public.set_item_price(
  p_kind text,
  p_item_id uuid,
  p_price numeric,
  p_from date default null,
  p_note text default null
)
returns void
language plpgsql
as $fn$
declare
  v_table  text;
  v_today  date := (now() at time zone 'America/New_York')::date;
  v_from   date := coalesce(p_from, (now() at time zone 'America/New_York')::date);
  v_later  boolean;
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

  -- Only the newest interval speaks for the catalog column.
  select exists (
    select 1 from public.item_price_history h
    where h.item_kind = p_kind
      and h.item_id = p_item_id
      and h.effective_from > v_from
  ) into v_later;

  if v_from <= v_today and not v_later then
    execute format('update public.%I set price = $1 where id = $2', v_table)
      using p_price, p_item_id;
  end if;
end;
$fn$;

do $$
begin
  if pg_get_functiondef('public.set_item_price(text,uuid,numeric,date,text)'::regprocedure)
     not ilike '%v_later%' then
    raise exception 'C: set_item_price does not check for a later interval';
  end if;
  raise notice 'set_item_price only moves the catalog column when it is the newest interval';
end $$;
