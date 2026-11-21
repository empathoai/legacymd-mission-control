-- C20: the catalog column is the price in force today.
-- `treatments.price` (what the catalog screen shows) must equal the open price
-- interval `price_on` resolves (what a sale freezes as its list price). Two prices
-- for one item means the desk sees one number and the line records another.
select 'treatment' as kind,
       t.code,
       t.price as catalog_price,
       public.price_on('treatment', t.id, current_date) as interval_price
from public.treatments t
where t.active
  and t.price is distinct from public.price_on('treatment', t.id, current_date)
union all
select 'product', p.code, p.price, public.price_on('product', p.id, current_date)
from public.products p
where p.active
  and p.price is distinct from public.price_on('product', p.id, current_date)
union all
select 'service', s.code, s.price, public.price_on('service', s.id, current_date)
from public.services s
where s.active
  and s.price is distinct from public.price_on('service', s.id, current_date);
