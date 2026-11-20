-- C06: after the cutover, the list price frozen on a line equals the price history row
-- effective on the sale date. Historical lines are out of scope: their reference has no
-- real date.
select
  i.id,
  s.occurred_on,
  i.list_price,
  h.price as history_price
from public.sale_items i
join public.sales s on s.id = i.sale_id
join lateral (
  select h.price
  from public.item_price_history h
  where h.item_kind = case
          when i.treatment_id is not null then 'treatment'
          when i.product_id is not null then 'product'
          else 'service'
        end
    and h.item_id = coalesce(i.treatment_id, i.product_id, i.service_id)
    and h.effective_from <= s.occurred_on
  order by h.effective_from desc
  limit 1
) h on true
where s.occurred_on >= date '2026-11-20'
  and coalesce(i.treatment_id, i.product_id, i.service_id) is not null
  and (i.list_price is null or i.list_price is distinct from h.price)
order by s.occurred_on, i.id;
