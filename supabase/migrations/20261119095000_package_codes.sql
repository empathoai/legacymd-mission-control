-- 20261119095000_package_codes.sql
-- A package is a treatment with unit_type = 'package', but it is a different thing to sell
-- and to read: it gets its own code series, PCK-, instead of hiding inside TRT-.
-- Four series, each numbered on its own: TRT-, PCK-, PROD-, SRV-.

-- 1. Renumber, using a temporary code so the unique constraint never collides.
update public.treatments set code = 'TMP-' || id::text;

with numbered as (
  select id, row_number() over (order by name, id) as rn
  from public.treatments
  where unit_type = 'package'
)
update public.treatments t
set code = 'PCK-' || lpad(n.rn::text, 4, '0')
from numbered n where n.id = t.id;

with numbered as (
  select id, row_number() over (order by name, id) as rn
  from public.treatments
  where unit_type <> 'package' or unit_type is null
)
update public.treatments t
set code = 'TRT-' || lpad(n.rn::text, 4, '0')
from numbered n where n.id = t.id;

-- 2. The next code is the next number of that series, not of the table.
create or replace function public.assign_catalog_code() returns trigger
language plpgsql as $$
declare
  prefix text;
  next_n integer;
begin
  if new.code is not null and btrim(new.code) <> '' then
    return new;
  end if;

  if TG_TABLE_NAME = 'treatments' then
    prefix := case when new.unit_type = 'package' then 'PCK-' else 'TRT-' end;
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

-- 3. Expose the package flag where the catalog is read.
create or replace view public.catalog_items with (security_invoker = true) as
select
  'treatment'::text                                    as item_kind,
  t.id                                                  as item_id,
  t.code,
  t.name,
  t.price,
  public.cost_on('treatment', t.id, current_date)       as current_cost,
  t.active,
  t.unit_type
from public.treatments t
union all
select
  'product'::text,
  p.id,
  p.code,
  p.name,
  p.price,
  public.cost_on('product', p.id, current_date),
  p.active,
  null::text
from public.products p
union all
select
  'service'::text,
  s.id,
  s.code,
  s.name,
  s.price,
  public.cost_on('service', s.id, current_date),
  s.active,
  null::text
from public.services s;

comment on view public.catalog_items is
  'One row per sellable catalog item: kind, code, name, list price, the cost in force today, the active flag and unit_type (package or unit for treatments).';
