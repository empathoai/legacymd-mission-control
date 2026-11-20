-- C05: after the cutover, every sale line resolves to a cost interval.
-- A line with no interval on its sale date has no cost: the margin cannot be computed.
select
  i.id,
  s.occurred_on,
  coalesce(t.name, p.name, sv.name, i.description) as item,
  i.treatment_id,
  i.product_id,
  i.service_id
from public.sale_items i
join public.sales s on s.id = i.sale_id
join public.sale_line_cost c on c.sale_item_id = i.id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services sv on sv.id = i.service_id
where s.occurred_on >= date '2026-11-20'
  and c.unit_cost is null
order by s.occurred_on, i.id;
