-- 20261119092600_treatment_description.sql
-- A package is one thing with one price, and what it contains is free text the
-- owner writes. No composition table: the contents are a note, not a model.

alter table public.treatments add column if not exists description text;

comment on column public.treatments.description is
  'Free text: what the package or treatment includes. For packages this is what the owner writes; nothing is inferred from it.';

comment on column public.treatments.unit_type is
  'unit = one treatment sold by quantity, package = one bundle sold with quantity 1 and its own price.';
