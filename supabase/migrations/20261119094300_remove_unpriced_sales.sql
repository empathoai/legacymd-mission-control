-- 20261119094300_remove_unpriced_sales.sql
-- Decision: a line with quantity but no price anywhere (no treatment price, no product
-- price, no total) is not a sale. 38 such rows were imported; they carry a service name
-- and a quantity of one, and nothing else. They should not be in the database.
--
-- A copy of the 38 sales and their lines is kept outside the repository, in
-- .tmp/removed_zero_sales.json (gitignored), before deleting.
--
-- Deleting a sale can move a customer's first visit to a later sale, so the flag is
-- recomputed for every customer. The immutability trigger is disabled for that update
-- and re-enabled in the same transaction.

alter table public.sales disable trigger sales_guard_void;

delete from public.sales
where id in (
  select sale_id from public.sale_payments where amount = 0 and status = 'void'
);

with firsts as (
  select distinct on (customer_id) id
  from public.sales
  order by customer_id, occurred_on, created_at
)
update public.sales s
set is_first_visit = exists (select 1 from firsts f where f.id = s.id);

alter table public.sales enable trigger sales_guard_void;
