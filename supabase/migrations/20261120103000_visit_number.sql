-- 20261120103000_visit_number.sql
-- The clinic workbook numbers the visits of each patient. Store that ordinal on the sale: it is
-- the only place where "visit 1, visit 2" is a fact and not a calculation over dates.

alter table public.sales add column if not exists visit_number integer;

alter table public.sales
  add constraint sales_visit_number_positive
  check (visit_number is null or visit_number >= 1);

alter table public.sales
  add constraint sales_first_visit_matches_number
  check (visit_number is null or is_first_visit = (visit_number = 1));

create unique index if not exists sales_customer_visit_number_key
  on public.sales (customer_id, visit_number)
  where visit_number is not null;

comment on column public.sales.visit_number is
  'Ordinal of the visit in the patient history, as the clinic recorded it. 1 is the first visit.';
