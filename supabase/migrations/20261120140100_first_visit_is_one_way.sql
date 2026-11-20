-- 20261120140100_first_visit_is_one_way.sql
-- A second sale on the same business day shares the visit ordinal, so a row can be
-- visit 1 without being the first visit. The old constraint required the two to
-- agree both ways; the rule that matters is only one direction: a first visit is
-- always visit 1. The other direction (one first visit per patient) is C07.

alter table public.sales drop constraint if exists sales_first_visit_matches_number;

alter table public.sales
  add constraint sales_first_visit_is_visit_one check (
    not is_first_visit or visit_number = 1
  );
