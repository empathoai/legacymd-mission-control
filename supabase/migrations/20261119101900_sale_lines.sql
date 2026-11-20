-- 101900_sale_lines.sql
-- Sales details lists every sold line: the sale, the patient and the item, with what was
-- charged. One row per line, as the workbook had, but read-only.

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
  i.discount
from public.sale_items i
join public.sales s on s.id = i.sale_id
join public.customers c on c.id = s.customer_id
left join public.treatments t on t.id = i.treatment_id
left join public.products p on p.id = i.product_id
left join public.services sv on sv.id = i.service_id;

comment on view public.sale_lines is
  'Every sold line with its sale and patient. Sales details reads this; nothing writes here.';
