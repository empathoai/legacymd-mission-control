-- 20261119091900_sale_item_discount.sql
-- A sale can be charged below the catalog price (negotiation, promo, courtesy).
-- Until now the line only stored what was charged, so the discount vanished.
-- Each line now keeps the list price it was measured against and the discount
-- that resulted. Both are data on the line: a later catalog change does not
-- rewrite history.

alter table public.sale_items add column if not exists list_price numeric(10,2) check (list_price >= 0);

alter table public.sale_items
  add column if not exists discount numeric(12,2)
  generated always as ((coalesce(list_price, unit_price) - unit_price) * quantity) stored;

comment on column public.sale_items.list_price is 'Catalog price at sale time. The discount is measured against it.';
comment on column public.sale_items.discount is 'list_price - unit_price, times quantity. Positive means money given away.';

-- backfill: the catalog price we know today becomes the reference for history
update public.sale_items i
set list_price = coalesce(
  (select t.price from public.treatments t where t.id = i.treatment_id),
  (select p.price from public.products p where p.id = i.product_id),
  (select s.price from public.services s where s.id = i.service_id),
  i.unit_price
)
where i.list_price is null;

create or replace view public.discount_by_month as
select
  date_trunc('month', s.occurred_on)::date                          as month,
  count(*) filter (where i.discount > 0)                            as discounted_lines,
  sum(i.line_total)::numeric(12,2)                                  as charged,
  sum(i.list_price * i.quantity)::numeric(12,2)                     as list_value,
  sum(i.discount)::numeric(12,2)                                    as discount
from public.sale_items i
join public.sales s on s.id = i.sale_id
group by 1
order by 1;

comment on view public.discount_by_month is 'How much was sold, how much it listed for, and what was given away.';
