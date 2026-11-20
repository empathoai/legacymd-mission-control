-- 100900_item_names.sql
-- A new catalog item is created with a name and a price; the normalized key that the unique
-- constraint and the sale importer rely on is computed here, never typed.
-- Same rules the import used for items: lowercase, strip accents, non-alphanumeric to space.

create or replace function public.normalize_item_name(p_name text)
returns text
language sql immutable
as $$
  select btrim(regexp_replace(
           regexp_replace(
             translate(lower(btrim(p_name)),
               'áàäâãéèëêíìïîóòöôõúùüûñç',
               'aaaaaeeeeiiiiooooouuuunc'),
             '[^a-z0-9]+', ' ', 'g'),
           '\s+', ' ', 'g'))
$$;

comment on function public.normalize_item_name(text) is
  'The key the catalog unique constraint uses: lowercase, no accents, non-alphanumeric as spaces.';

create or replace function public.set_item_normalized_name() returns trigger
language plpgsql
as $$
begin
  new.normalized_name := public.normalize_item_name(new.name);
  if new.normalized_name = '' then
    raise exception 'the name needs at least one letter or digit' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists treatments_set_normalized_name on public.treatments;
create trigger treatments_set_normalized_name
  before insert or update of name on public.treatments
  for each row execute function public.set_item_normalized_name();

drop trigger if exists products_set_normalized_name on public.products;
create trigger products_set_normalized_name
  before insert or update of name on public.products
  for each row execute function public.set_item_normalized_name();

drop trigger if exists services_set_normalized_name on public.services;
create trigger services_set_normalized_name
  before insert or update of name on public.services
  for each row execute function public.set_item_normalized_name();
