-- 20261121140000_restore_unit_treatments.sql
-- A TRT is a unit treatment: one session with its own price and cost. It is not the
-- monthly slice of a package, and dividing a package by its duration to price a unit
-- is package logic applied to the wrong kind.
--
-- The two unit rows touched earlier today are restored to the catalog values they
-- had. Whatever they should cost is the owner's number, not a derived one.

select public.set_item_cost(
  'treatment',
  (select id from public.treatments where code = 'TRT-0012'),
  244.00
);

select public.set_item_price(
  'treatment',
  (select id from public.treatments where code = 'TRT-0037'),
  1512.00,
  null,
  'restored: unit treatment keeps its own price'
);

select public.set_item_cost(
  'treatment',
  (select id from public.treatments where code = 'TRT-0037'),
  195.00
);
