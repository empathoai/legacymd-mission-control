-- 20261121100000_resolve_customer_exact.sql
-- The alias lookup was a bridge for the import: the master had spelling variants
-- recorded, and the create path used them to avoid opening a second row.
--
-- The clinic does not create patients on a hunch: an existing patient is found in the
-- search and the sale is recorded against them. `aliases` stays as the historical
-- record of how a name was spelled in the source file; it is not a matching key.

create or replace function public.resolve_customer(
  p_name  text,
  p_phone text default null,
  p_birth date default null
) returns uuid
language plpgsql
as $$
declare
  v_norm text;
  v_id   uuid;
begin
  if p_name is null or length(btrim(p_name)) < 2 then
    raise exception 'a name of at least 2 characters is required' using errcode = '22023';
  end if;
  if p_birth is not null and p_birth > current_date then
    raise exception 'a birth date cannot be in the future' using errcode = '22023';
  end if;

  v_norm := public.normalize_person_name(p_name);

  select id into v_id from public.customers where normalized_name = v_norm;
  if v_id is not null then
    update public.customers
    set phone = coalesce(phone, p_phone),
        birth_date = coalesce(birth_date, p_birth)
    where id = v_id;
    return v_id;
  end if;

  insert into public.customers (full_name, normalized_name, aliases, phone, birth_date)
  values (btrim(p_name), v_norm, '{}'::text[], p_phone, p_birth)
  on conflict (normalized_name) do nothing;

  select id into v_id from public.customers where normalized_name = v_norm;
  return v_id;
end;
$$;

drop function if exists public.customer_by_alias(text);

comment on column public.customers.aliases is
  'Spellings seen in the import. Historical record only: the master does not match on it.';

comment on function public.resolve_customer(text, text, date) is
  'Returns the patient with that exact normalized name, or creates it. The caller searches first.';
