-- 093600_sale_payments_void_columns.sql
-- The plan needs a way to record that a installment will never be charged. The column arrives
-- before the conversion so the zero-amount courtesies can be voided in place.

alter table public.sale_payments
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;
