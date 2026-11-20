-- 100800_payment_rows_do_not_add_revenue.sql
-- PROD-0023 and PROD-0024 are payment lines typed into the workbook next to a real treatment.
-- The clinic confirmed they pay a treatment that was never registered here, so they must not
-- add revenue. The sale lines stay untouched: a separate adjustment removes the revenue and
-- leaves the cash collected, which turns the amount into a credit in the patient's favour.
--
--   Gloria Galvez          2026-07-23    362.00   PROD-0024
--   Claudia Rodriguez      2026-08-29    400.00   PROD-0023
--   Blanca Pinto Rotella   2026-10-21  1.000.00   PROD-0024
--
-- The reason on each row is the note to raise with the clinic.

insert into public.adjustments
  (occurred_on, customer_id, sale_id, kind, revenue_delta, cash_delta, reason, recorded_by)
select
  s.occurred_on,
  s.customer_id,
  s.id,
  'other',
  -i.line_total,
  0,
  'Payment line ' || p.code || ' was imported as a sale; it pays a treatment that was never '
    || 'registered here. Confirm with the clinic.',
  'clinic'
from public.sale_items i
join public.sales s on s.id = i.sale_id
join public.products p on p.id = i.product_id
where p.code in ('PROD-0023', 'PROD-0024');
