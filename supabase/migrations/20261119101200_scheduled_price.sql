-- 101200_scheduled_price.sql
-- A price change dated tomorrow is stored but invisible: the catalog lists the price in force
-- today. The view now also exposes the next scheduled price, so the screen can show it.

create or replace function public.price_next(
  p_kind    text,
  p_item_id uuid,
  p_at      date
) returns table (price numeric, effective_from date)
language sql stable
as $$
  select h.price, h.effective_from
  from public.item_price_history h
  where h.item_kind = p_kind
    and h.item_id = p_item_id
    and h.effective_from > p_at
  order by h.effective_from
  limit 1
$$;

comment on function public.price_next(text, uuid, date) is
  'The first price dated after a day, if any: the scheduled change.';

create or replace view public.catalog_items with (security_invoker = true) as
select
  'treatment'::text                                    as item_kind,
  t.id                                                  as item_id,
  t.code,
  t.name,
  coalesce(
    public.price_on('treatment', t.id, (now() at time zone 'America/New_York')::date),
    t.price
  )::numeric(10,2)                                      as price,
  public.cost_at('treatment', t.id, now())              as current_cost,
  t.active,
  t.unit_type,
  n.price                                               as next_price,
  n.effective_from                                      as next_price_from
from public.treatments t
left join lateral public.price_next(
  'treatment', t.id, (now() at time zone 'America/New_York')::date
) n on true
union all
select
  'product'::text,
  p.id,
  p.code,
  p.name,
  coalesce(
    public.price_on('product', p.id, (now() at time zone 'America/New_York')::date),
    p.price
  )::numeric(10,2),
  public.cost_at('product', p.id, now()),
  p.active,
  null::text,
  n.price,
  n.effective_from
from public.products p
left join lateral public.price_next(
  'product', p.id, (now() at time zone 'America/New_York')::date
) n on true
union all
select
  'service'::text,
  s.id,
  s.code,
  s.name,
  coalesce(
    public.price_on('service', s.id, (now() at time zone 'America/New_York')::date),
    s.price
  )::numeric(10,2),
  public.cost_at('service', s.id, now()),
  s.active,
  null::text,
  n.price,
  n.effective_from
from public.services s
left join lateral public.price_next(
  'service', s.id, (now() at time zone 'America/New_York')::date
) n on true;
