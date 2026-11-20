-- C08: the historical window still totals what the owner verified in the consolidated file: 219.460,91.
-- This is the only check whose oracle lives outside the database.
select
  round(coalesce(sum(i.line_total), 0), 2) as total,
  219460.91::numeric as expected
from public.sale_items i
join public.sales s on s.id = i.sale_id
where s.occurred_on <= date '2026-11-19'
having round(coalesce(sum(i.line_total), 0), 2) <> 219460.91::numeric;
