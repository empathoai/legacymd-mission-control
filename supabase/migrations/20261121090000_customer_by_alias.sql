-- 20261121090000_customer_by_alias.sql
-- The master keeps retired spellings in `aliases`; the create screen needs to know
-- that the typed name is one of them before it reports "created".
--
-- The lookup normalizes both sides, so the case and the accents of the stored
-- spelling do not matter.

create or replace function public.customer_by_alias(p_name text)
returns uuid
language sql
stable
as $$
  select c.id
  from public.customers c
  cross join lateral unnest(c.aliases) as a(alias_name)
  where public.normalize_person_name(a.alias_name) = public.normalize_person_name(p_name)
  limit 1
$$;

comment on function public.customer_by_alias(text) is
  'The patient whose recorded alias normalizes to this name, or null. Used before creating a customer.';
