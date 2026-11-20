-- 20261120120100_appointment_intake.sql
-- The bot books in GoHighLevel and GHL pushes the appointment to us. GHL retries a
-- delivery it did not see answered, so the booking needs an idempotency key: the
-- appointment id, namespaced by source. The desk's bookings keep it null.
--
-- GHL never sends an outcome. The pipeline the clinic moves there is theirs; the
-- show-up and the no-show are marked here, by the desk, through resolve_appointment.
--
-- A calendar maps to one expected category and one default source. The bot does not
-- know our taxonomy, and `expected_category_id` is not null: guessing a category
-- would put a booking in the wrong column of every report, so an unmapped calendar
-- is refused by the caller instead.

alter table public.appointments
  add column if not exists external_ref text;

-- NULLs are distinct in a unique index, so every desk booking may stay null.
create unique index if not exists appointments_external_ref_uidx
  on public.appointments (external_ref);

comment on column public.appointments.external_ref is
  'Idempotency key of an external booking, ghl:<appointment id>. Null when the desk booked it.';

create table if not exists public.ghl_calendar_map (
  calendar_id   text primary key,
  calendar_name text,
  category_id   uuid not null references public.categories(id) on delete restrict,
  source_id     uuid not null references public.sources(id) on delete restrict,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ghl_calendar_id_sane check (length(btrim(calendar_id)) between 1 and 128)
);

comment on table public.ghl_calendar_map is
  'GHL calendar -> expected category and default source. An unmapped calendar is refused, never guessed.';

alter table public.ghl_calendar_map enable row level security;

create or replace function public.book_appointment_external(
  p_customer_id  uuid,
  p_scheduled_at timestamptz,
  p_category_id  uuid,
  p_source_id    uuid,
  p_ref          text,
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
  if p_ref is null or length(btrim(p_ref)) < 3 then
    raise exception 'an external reference of at least 3 characters is required'
      using errcode = '22023';
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
    (customer_id, scheduled_at, expected_category_id, source_id, created_by, external_ref)
  values
    (p_customer_id, p_scheduled_at, p_category_id, p_source_id, p_by, btrim(p_ref))
  on conflict (external_ref) do nothing
  returning id into v_id;

  -- A retry finds the row instead of raising: the webhook answers 200 twice.
  if v_id is null then
    select id into v_id from public.appointments where external_ref = btrim(p_ref);
  end if;

  return v_id;
end;
$$;

comment on function public.book_appointment_external(uuid, timestamptz, uuid, uuid, text, text) is
  'Records a booking that came from outside; returns the existing one when the reference is already known, so a retry is not a second booking.';
