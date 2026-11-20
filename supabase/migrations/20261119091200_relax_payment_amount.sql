-- 20261119091200_relax_payment_amount.sql
-- A zero-amount payment is real: comped visits and "paid in full already" rows
-- exist in the workbook. `amount > 0` rejected them, so allow zero.

alter table public.sale_payments drop constraint if exists sale_payments_amount_check;
alter table public.sale_payments add constraint sale_payments_amount_check check (amount >= 0);
