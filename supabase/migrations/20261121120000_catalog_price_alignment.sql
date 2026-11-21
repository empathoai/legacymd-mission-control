-- 20261121120000_catalog_price_alignment.sql
-- The catalog carries the price twice: `treatments.price` (the number the screen
-- shows) and `item_price_history` (the interval `price_on` resolves, which is what
-- a sale freezes as its list price). They disagreed on 17 active items, so the desk
-- saw one price and the line froze another.
--
-- The catalog column is the price in force today, by design. This aligns the
-- interval to it, from today: the past keeps its intervals, the future charges what
-- the catalog shows. From here C20 refuses the two from drifting apart again.

do $$
declare
  r     record;
  v_day date := (now() at time zone 'America/New_York')::date;
begin
  for r in
    select 'treatment' as kind, t.id, t.price
    from public.treatments t
    where t.active and t.price is not null
      and t.price is distinct from public.price_on('treatment', t.id, current_date)
    union all
    select 'product', p.id, p.price
    from public.products p
    where p.active and p.price is not null
      and p.price is distinct from public.price_on('product', p.id, current_date)
    union all
    select 'service', s.id, s.price
    from public.services s
    where s.active and s.price is not null
      and s.price is distinct from public.price_on('service', s.id, current_date)
  loop
    perform public.set_item_price(
      r.kind,
      r.id,
      r.price,
      v_day,
      'aligned to the price the catalog shows'
    );
  end loop;
end;
$$;
