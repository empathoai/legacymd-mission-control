-- 094100_load_workbook_lines.sql
-- The four summary lines the workbook kept outside the dated rows. They are not sales and
-- were never imported. Three belong here; the July +1.130 stays out by decision D4.
-- Idempotent: each insert is guarded by a not-exists.

-- August: the Frank Alonso refund, 837, already paid out.
insert into public.sale_refunds
  (sale_id, amount, refunded_on, method_id, kind, state, refunded_at, reason, recorded_by)
select s.id, 837.00, date '2026-08-31', pm.id, 'refund', 'refunded', date '2026-08-31',
       'Frank Alonso refund, workbook August summary line', 'import'
from public.sales s
join public.customers c on c.id = s.customer_id
join public.payment_methods pm on pm.slug = 'unspecified'
where c.full_name = 'Frank Alonso'
  and s.occurred_on = date '2026-08-15'
  and not exists (select 1 from public.sale_refunds r where r.sale_id = s.id);

-- September: Stripe no-show charge, 1.876, collected.
insert into public.adjustments
  (occurred_on, customer_id, sale_id, kind, revenue_delta, cash_delta, reason, recorded_by)
select date '2026-09-30', null, null, 'no_show', 1876.00, 1876.00,
       'Stripe no-show, workbook September summary line', 'import'
where not exists (
  select 1 from public.adjustments
  where kind = 'no_show' and reason like '%septiembre%'
);

-- October: Stripe no-show charge, 1.151, collected.
insert into public.adjustments
  (occurred_on, customer_id, sale_id, kind, revenue_delta, cash_delta, reason, recorded_by)
select date '2026-10-31', null, null, 'no_show', 1151.00, 1151.00,
       'Stripe no-show, workbook October summary line', 'import'
where not exists (
  select 1 from public.adjustments
  where kind = 'no_show' and reason like '%octubre%'
);
