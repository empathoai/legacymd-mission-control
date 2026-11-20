-- 100700_payment_rows_are_not_products.sql
-- PROD-0023 and PROD-0024 are not products. Each is a payment line typed into the workbook
-- next to a real treatment:
--   PROD-0024 "Payment completion from another treat."   362 on 2026-07-23, 1.000 on 2026-10-21
--   PROD-0023 "Payment applied to House Credit..."       400 on 2026-08-29
-- They cannot be sold, so they are deactivated. Their three sale lines stay: the revenue
-- they carry is part of the 219.492,91 baseline, and removing it is a separate accounting
-- decision about which earlier sale those payments belong to.

update public.products
set active = false
where code in ('PROD-0023', 'PROD-0024');

comment on table public.products is
  'Retail and injectables. PROD-0023 and PROD-0024 are payment lines typed in the workbook, not products; they stay inactive for history.';
