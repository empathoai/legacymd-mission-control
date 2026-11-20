-- 20261120104000_membership_kind.sql
-- The clinic sells four kinds of things, and a membership is not a package: it is a recurring
-- plan (Botox Membership) with its own code series. The catalog taxonomy is written down in
-- docs/catalog-taxonomy.md.

alter table public.treatments drop constraint treatments_unit_type_check;

alter table public.treatments
  add constraint treatments_unit_type_check
  check (unit_type = any (array['unit', 'package', 'membership']));

create or replace function public.assign_catalog_code() returns trigger
language plpgsql
as $$
declare
  prefix text;
  next_n integer;
begin
  if new.code is not null and btrim(new.code) <> '' then
    return new;
  end if;

  if TG_TABLE_NAME = 'treatments' then
    prefix := case new.unit_type
                when 'package' then 'PCK-'
                when 'membership' then 'MEM-'
                else 'TRT-'
              end;
  elsif TG_TABLE_NAME = 'products' then
    prefix := 'PROD-';
  else
    prefix := 'SRV-';
  end if;

  execute format(
    'select coalesce(max(substring(code from ''[0-9]+$'')::int), 0) + 1
       from public.%I where code like %L',
    TG_TABLE_NAME, prefix || '%'
  ) into next_n;

  new.code := prefix || lpad(next_n::text, 4, '0');
  return new;
end;
$$;

comment on column public.treatments.unit_type is
  'unit: one session. package: a bundle sold once. membership: a recurring plan.';
