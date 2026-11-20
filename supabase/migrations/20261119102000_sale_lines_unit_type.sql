-- 102000_sale_lines_unit_type.sql
-- A package and a treatment are both treatment_id in the line. The details screen has to tell
-- them apart, so the view carries the unit type.

create or replace view public.sale_lines with (security_invoker = true) as
select
  i.id                                                as sale_item_id,
  s.id                                                as sale_id,
  s.occurred_on,
  s.customer_id,
  c.full_name                                         as customer_name,
  s.voided_at is not null                             as voided,
  case
    when i.treatment_id is not null then 'treatment'
    when i.product_id is not null then 'product'
    when i.service_id is not null then 'service'
    else 'other'
  end                                                 as kind,
  coalesce(t.name, p.name, sv.name, i.description)    as item_name,
  i.quantity,
  i.unit_price,
  i.line_total,
  i.list_price,
  i.discount,
  t.unit_type
from public.sale_items i
join public.sales s on s.id = i.sale_id
join public.customers c on c.id = s.customer_id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services sv on sv.id = i.service_id;
