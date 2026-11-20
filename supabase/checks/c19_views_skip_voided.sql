-- C19: the expense totals skip voided lines. Today no line is voided, so a numeric
-- comparison cannot bite; what can be asserted is that every view carrying a total
-- filters on voided_at. The control replaces one of them without the filter.
select v.view_name
from (values
  ('expense_by_category'),
  ('monthly_pl'),
  ('monthly_balance')
) as v(view_name)
where pg_get_viewdef(('public.' || v.view_name)::regclass) not ilike '%voided_at is null%';
