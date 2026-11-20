-- 100300_appointment_functions.sql
-- The only supported writes. Each one writes its control columns together, as every other
-- stateful table in this schema does.

create or replace function public.normalize_person_name(p_name text)
returns text
language sql immutable
as $$
  select btrim(regexp_replace(
           regexp_replace(
             translate(lower(regexp_replace(p_name, '\s*[-–—/()]\s*.*$', '')),
               'áàäâãéèëêíìïîóòöôõúùüûñç',
               'aaaaaeeeeiiiiooooouuuunc'),
             '[^a-z0-9]+', ' ', 'g'),
           '\s+', ' ', 'g'))
$$;

comment on function public.normalize_person_name(text) is
  'The same rules the import used: drop the tail after -, / or (, lowercase, strip accents. Verified against all 188 rows.';

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

comment on function public.resolve_customer(text, text, date) is
  'Finds the customer by normalized name or creates her. The only writer of the master from the desk.';

create or replace function public.book_appointment(
  p_customer_id  uuid,
  p_scheduled_at timestamptz,
  p_category_id  uuid,
  p_source_id    uuid,
  p_by           text
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'created_by is required' using errcode = '22023';
  end if;
  if p_scheduled_at is null then
    raise exception 'a slot is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'customer % does not exist', p_customer_id using errcode = '23503';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'category % does not exist', p_category_id using errcode = '23503';
  end if;
  if not exists (select 1 from public.sources where id = p_source_id) then
    raise exception 'source % does not exist', p_source_id using errcode = '23503';
  end if;

  insert into public.appointments
    (customer_id, scheduled_at, expected_category_id, source_id, created_by)
  values
    (p_customer_id, p_scheduled_at, p_category_id, p_source_id, p_by)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.book_appointment(uuid, timestamptz, uuid, uuid, text) is
  'Records a booking. A past slot is allowed: the clinic types yesterday today.';

create or replace function public.resolve_appointment(
  p_id     uuid,
  p_status text,
  p_by     text,
  p_reason text default null
) returns void
language plpgsql
as $$
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'resolved_by is required' using errcode = '22023';
  end if;
  if p_status not in ('show_up', 'no_show', 'cancelled') then
    raise exception 'unknown outcome %', p_status using errcode = '22023';
  end if;
  if p_status = 'cancelled' and (p_reason is null or length(btrim(p_reason)) < 4) then
    raise exception 'a cancellation needs a reason of at least 4 characters' using errcode = '22023';
  end if;

  update public.appointments
  set status = p_status,
      resolved_at = now(),
      resolved_on = (now() at time zone 'America/New_York')::date,
      resolved_by = p_by,
      cancel_reason = case when p_status = 'cancelled' then btrim(p_reason) else null end,
      updated_at = now(),
      updated_by = p_by
  where id = p_id and status = 'booked';

  if not found then
    raise exception 'booking % does not exist or is already resolved', p_id using errcode = '23503';
  end if;
end;
$$;

comment on function public.resolve_appointment(uuid, text, text, text) is
  'Marks the outcome once. A resolved booking never changes again.';

create or replace function public.reschedule_appointment(
  p_id     uuid,
  p_new_at timestamptz,
  p_by     text,
  p_reason text
) returns void
language plpgsql
as $$
declare
  v_old    timestamptz;
  v_status text;
begin
  if p_by is null or btrim(p_by) = '' then
    raise exception 'changed_by is required' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 4 then
    raise exception 'a reason of at least 4 characters is required' using errcode = '22023';
  end if;
  if p_new_at is null then
    raise exception 'a new slot is required' using errcode = '22023';
  end if;

  select scheduled_at, status into v_old, v_status
  from public.appointments
  where id = p_id;

  if v_old is null then
    raise exception 'booking % does not exist', p_id using errcode = '23503';
  end if;
  if v_status <> 'booked' then
    raise exception 'a resolved booking cannot be rescheduled' using errcode = '23514';
  end if;
  if p_new_at <= now() then
    raise exception 'a booking cannot be moved into the past' using errcode = '23514';
  end if;

  insert into public.appointment_changes
    (appointment_id, old_scheduled_at, new_scheduled_at, changed_by, reason)
  values
    (p_id, v_old, p_new_at, p_by, btrim(p_reason));

  update public.appointments
  set scheduled_at = p_new_at,
      updated_at = now(),
      updated_by = p_by
  where id = p_id;
end;
$$;

comment on function public.reschedule_appointment(uuid, timestamptz, text, text) is
  'Moves a booked slot and writes the audit row first, so the guard can verify it.';

create or replace function public.guard_appointment() returns trigger
language plpgsql
as $$
begin
  if old.status <> 'booked' then
    raise exception 'a resolved booking cannot change' using errcode = '23514';
  end if;

  if new.scheduled_at <> old.scheduled_at then
    if not exists (
      select 1 from public.appointment_changes
      where appointment_id = old.id
        and old_scheduled_at = old.scheduled_at
        and new_scheduled_at = new.scheduled_at
    ) then
      raise exception 'moving a booking requires an audit row' using errcode = '23514';
    end if;
  end if;

  if new.status <> old.status
     and not (old.status = 'booked'
              and new.status in ('show_up', 'no_show', 'cancelled')) then
    raise exception 'invalid transition % to %', old.status, new.status using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists appointments_guard on public.appointments;
create trigger appointments_guard
  before update on public.appointments
  for each row execute function public.guard_appointment();

create or replace function public.link_sale_appointment() returns trigger
language plpgsql
as $$
declare
  v_customer uuid;
  v_status   text;
begin
  if new.appointment_id is null then
    return new;
  end if;

  select customer_id, status into v_customer, v_status
  from public.appointments
  where id = new.appointment_id
  for update;

  if v_customer is null then
    raise exception 'booking % does not exist', new.appointment_id using errcode = '23503';
  end if;
  if v_customer <> new.customer_id then
    raise exception 'the sale customer does not match the booking customer' using errcode = '23514';
  end if;
  if v_status in ('no_show', 'cancelled') then
    raise exception 'a sale cannot be linked to a % booking', v_status using errcode = '23514';
  end if;

  if v_status = 'booked' then
    update public.appointments
    set status = 'show_up',
        resolved_at = now(),
        resolved_on = (now() at time zone 'America/New_York')::date,
        resolved_by = 'system',
        updated_by = 'system'
    where id = new.appointment_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sales_link_appointment on public.sales;
create trigger sales_link_appointment
  before insert on public.sales
  for each row execute function public.link_sale_appointment();

create or replace function public.appointment_changes_immutable() returns trigger
language plpgsql
as $$
begin
  raise exception 'appointment_changes is append-only' using errcode = '23514';
end;
$$;

drop trigger if exists appointment_changes_append_only on public.appointment_changes;
create trigger appointment_changes_append_only
  before update or delete on public.appointment_changes
  for each row execute function public.appointment_changes_immutable();

revoke update, delete on public.appointment_changes from anon, authenticated;
