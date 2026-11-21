-- 20261121080000_resolve_customer_aliases.sql
-- The master keeps the spellings seen for a patient in `aliases`, but nothing read
-- them: a typo was a new customer, which is how the import split 23 patients into
-- 26 extra records.
--
-- A name already recorded as an alias is that patient. The lookup normalizes each
-- alias the same way it normalizes an incoming name, so "Lili Sandoval" resolves to
-- Lily Sandoval instead of opening a second record.

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

  select c.id into v_id
  from public.customers c
  cross join lateral unnest(c.aliases) as a(alias_name)
  where public.normalize_person_name(a.alias_name) = v_norm
  limit 1;

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

comment on function public.resolve_customer(text, text, date) is
  'Returns the patient with that normalized name, one of its recorded aliases, or creates it. One patient, one row.';
