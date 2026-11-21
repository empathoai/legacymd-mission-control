-- 20261121110000_catalog_package_monthly.sql
-- The catalog had three package items whose price and cost were mixed levels: a
-- monthly price next to a four-month cost, or a package total next to a monthly
-- cost. That is not a reporting problem, it is a master problem: the cost interval
-- is what every margin reads.
--
-- The owner's shape: the stored value is the monthly unit, and the package is that
-- value times its duration. This file records the duration, fixes the one catalog
-- column that showed the package total, and moves the three monthly sellers to
-- their monthly cost **from today**. History is untouched on purpose: the sales
-- already recorded keep the cost reference they were measured against, and a
-- restatement is one deliberate call, not a side effect of this file.

-- 1. How many months a package covers.

alter table public.treatments
  add column if not exists duration_months smallint;

alter table public.treatments
  drop constraint if exists treatments_duration_positive;
alter table public.treatments
  add constraint treatments_duration_positive
  check (duration_months is null or duration_months >= 1);

comment on column public.treatments.duration_months is
  'Months a package covers. The package value is the stored monthly price and cost times this.';

update public.treatments
set duration_months = 4
where code in ('PCK-0016', 'PCK-0017', 'PCK-0015');

-- 2. The catalog column is the price in force today, and it must follow the
-- interval sales actually use. PCK-0016 showed the 1980 package total while its
-- open interval (from 2026-05-01) is the 495 monthly price.

update public.treatments
set price = 495.00
where code = 'PCK-0016' and price = 1980.00;

-- 3. Semaglutide's monthly seller carried the package total. Its package is
-- 1512 / 195 over 4 months, so one month is 378 / 48.75.

select public.set_item_price(
  'treatment',
  (select id from public.treatments where code = 'TRT-0037'),
  378.00,
  null,
  'monthly share of the 1512.00 package (1512 / 4)'
);

-- 4. The monthly cost, from today. The old interval stays in the record: sales
-- before today were measured with it.

select public.set_item_cost(
  'treatment',
  (select id from public.treatments where code = 'PCK-0016'),
  122.50
);
select public.set_item_cost(
  'treatment',
  (select id from public.treatments where code = 'TRT-0012'),
  61.00
);
select public.set_item_cost(
  'treatment',
  (select id from public.treatments where code = 'TRT-0037'),
  48.75
);
