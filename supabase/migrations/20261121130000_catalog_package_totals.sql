-- 20261121130000_catalog_package_totals.sql
-- The package is sold whole: 1980 over 4 months, paid in installments. The catalog
-- stores the package total and its duration; the 495 is the installment the plan
-- charges, not the price of the item. Storing the monthly value here would make the
-- sale freeze a list price of 495 while it charges 1980.
--
-- So the three package rows carry their totals, and the monthly sellers stay
-- separate: TRT-0012 for Timmix (250 / 61) and TRT-0037 for Semaglutide
-- (378 / 48.75). The monthly supply TRT-0023 is its own product and is not touched.

select public.set_item_price(
  'treatment',
  (select id from public.treatments where code = 'PCK-0016'),
  1980.00,
  null,
  'package total: 495.00 x 4 months'
);

select public.set_item_cost(
  'treatment',
  (select id from public.treatments where code = 'PCK-0016'),
  490.00
);

select public.set_item_price(
  'treatment',
  (select id from public.treatments where code = 'PCK-0015'),
  1512.00,
  null,
  'package total: 378.00 x 4 months'
);
